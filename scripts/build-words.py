#!/usr/bin/env python3
"""Build src/words.ts from the musiXmatch dataset, filtered to one or more genres.

Inputs (download into one directory, see README):
  mxm_dataset_train.txt.zip, mxm_dataset_test.txt.zip  - bag-of-words lyrics (Million Song Dataset)
  mxm_reverse_mapping.txt                              - stem -> readable word
  msd_tagtraum_cd2.cls.zip                             - tagtraum genre annotations for MSD tracks

Ranking metric is document frequency: the share of songs in the genre whose lyrics
contain the word at least once. Stopwords, interjections and stemming artifacts are dropped.

Usage:
  python3 -I scripts/build-words.py --data <dir> --genre Rock --top 500
"""

from __future__ import annotations

import argparse
import io
import re
import zipfile
from collections import Counter
from pathlib import Path

# Function words, pronouns, auxiliaries and other words that are in every song anyway.
STOPWORDS = set(
    """
    a an the and or but if so as of to in on at by for from with without about into onto over under
    i me my mine myself you your yours yourself he him his she her hers it its we us our ours they them their
    this that these those there here where when why how what which who whom whose
    is am are was were be been being do does did done doing have has had having will would shall should
    can could may might must ought need dare
    not no nor yes yeah yea nah ok okay
    up down out off away back again still just only even ever never always too very much many more most
    some any all each every both few little less least own other another such same than then now
    because while until unless though although whether either neither
    get got gets getting gotta gonna wanna gimme lemme
    let say said says tell told come came go went going gone make made take took put keep kept
    know knew think thought see saw look feel felt want need
    thing things something nothing anything everything someone anyone everyone nobody somebody anybody everybody
    way ways one ones
    oh ooh oooh ah aah uh um hmm mmm hey ho la na da ba doo dum wo whoa yo yah ya ye em
    """.split()
)

# Frequent but dull: adverbs, filler verbs, past participles the unstemmer picked, lyric annotations, profanity.
GENERIC = set(
    """
    like through right well around before left last good long bit already longer nice front beneath beyond
    worth meant realize slowly solo seems really far used mean once sure enough maybe set first pass best kind
    sometimes till goes round else after upon soon part matter along guess fine finally full between above easy
    clear lead rest alright become happen whole next lot different yet near across since cannot great anymore
    within pick sense quite point straight second met act top known seen heard gave
    whatever everywhere instead given brought spent cast form fit deal figure ahead beside below quick single
    decide ignore thank complete
    que und chorus verse fuck shit damn
    """.split()
)

# Artifacts of the dataset's custom tokenizer ("can't" -> "ca not", "gonna" -> "gon na", ...).
JUNK = set("ca wo sha gon wan ta nt n t s d ll re ve m ai em ya".split())

MIN_LEN = 3


def read_zip_lines(path: Path):
    with zipfile.ZipFile(path) as zf:
        name = zf.namelist()[0]
        with zf.open(name) as fh:
            for raw in io.TextIOWrapper(fh, encoding="utf-8", errors="replace"):
                yield raw.rstrip("\n")


def load_genre_tracks(path: Path, wanted: set[str]) -> set[str]:
    """tagtraum .cls: 'track_id<TAB>genre[<TAB>minority genre]', '#' comments."""
    wanted_lc = {g.lower() for g in wanted}
    tracks: set[str] = set()
    for line in read_zip_lines(path):
        if not line or line.startswith("#"):
            continue
        parts = line.split("\t")
        if parts[1].lower() in wanted_lc:
            tracks.add(parts[0])
    return tracks


def load_reverse_mapping(path: Path) -> dict[str, str]:
    """mxm_reverse_mapping.txt: 'stem<SEP>word' per line."""
    mapping: dict[str, str] = {}
    for line in path.read_text(encoding="utf-8", errors="replace").splitlines():
        if "<SEP>" not in line:
            continue
        stem, word = line.split("<SEP>", 1)
        mapping[stem.strip()] = word.strip()
    return mapping


def count_document_frequency(paths: list[Path], tracks: set[str]):
    """Returns (vocab, df Counter over vocab index, number of matched tracks)."""
    vocab: list[str] | None = None
    df: Counter[int] = Counter()
    n_tracks = 0
    for path in paths:
        for line in read_zip_lines(path):
            if not line or line.startswith("#"):
                continue
            if line.startswith("%"):
                words = line[1:].split(",")
                if vocab is None:
                    vocab = words
                elif vocab != words:
                    raise SystemExit("vocabularies differ between files")
                continue
            track_id, _mxm_id, *pairs = line.split(",")
            if track_id not in tracks:
                continue
            n_tracks += 1
            for pair in pairs:
                idx, _count = pair.split(":")
                df[int(idx) - 1] += 1  # word index starts at 1
    if vocab is None:
        raise SystemExit("no vocabulary line found")
    return vocab, df, n_tracks


def main() -> None:
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("--data", required=True, type=Path, help="directory with the downloaded files")
    ap.add_argument("--genre", action="append", default=[], help="tagtraum genre, repeatable (default: Rock)")
    ap.add_argument("--top", type=int, default=500, help="how many words to emit")
    ap.add_argument("--out", type=Path, default=Path("src/words.ts"))
    ap.add_argument("--csv", type=Path, default=Path("data/words.csv"), help="full ranked table for inspection")
    args = ap.parse_args()
    genres = set(args.genre) or {"Rock"}

    tracks = load_genre_tracks(args.data / "msd_tagtraum_cd2.cls.zip", genres)
    print(f"{len(tracks)} tracks tagged {sorted(genres)}")

    vocab, df, n_tracks = count_document_frequency(
        [args.data / "mxm_dataset_train.txt.zip", args.data / "mxm_dataset_test.txt.zip"], tracks
    )
    print(f"{n_tracks} of them have lyrics")

    mapping = load_reverse_mapping(args.data / "mxm_reverse_mapping.txt")

    rows: list[tuple[str, str, int]] = []
    seen: set[str] = set()
    for idx, count in df.most_common():
        stem = vocab[idx]
        word = mapping.get(stem, stem)
        if not re.fullmatch(r"[a-z]+", word) or len(word) < MIN_LEN:
            continue
        if {stem, word} & (STOPWORDS | GENERIC | JUNK):
            continue
        if word in seen:
            continue
        seen.add(word)
        rows.append((word, stem, count))

    top = rows[: args.top]

    args.csv.parent.mkdir(parents=True, exist_ok=True)
    with args.csv.open("w", encoding="utf-8") as fh:
        fh.write("rank,word,stem,songs,share\n")
        for rank, (word, stem, count) in enumerate(rows, 1):
            fh.write(f"{rank},{word},{stem},{count},{count / n_tracks:.4f}\n")

    header = (
        "// Generated by scripts/build-words.py - do not edit by hand.\n"
        f"// Source: musiXmatch dataset (Million Song Dataset) + tagtraum CD2 genre annotations.\n"
        f"// Genre: {', '.join(sorted(genres))}. {n_tracks} songs with lyrics.\n"
        f"// Ordered by how many of those songs contain the word; see {args.csv} for counts.\n"
    )
    body = ",\n".join(f"  '{word}'" for word, _stem, _count in top)
    args.out.write_text(f"{header}export const WORDS: string[] = [\n{body},\n]\n", encoding="utf-8")
    print(f"wrote {len(top)} words to {args.out}; first ten: {[w for w, _, _ in top[:10]]}")


if __name__ == "__main__":
    main()
