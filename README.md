# Sing4Me

Party game: a word is shown, first player to name a song containing that word wins the round.

```sh
bun install
bun run dev      # http://localhost:5173
bun run build    # static output in dist/
```

Words come from `src/words.ts`, generated from real lyrics data (see below). Edit `scripts/build-words.py` to tune filters, not the generated file.

Controls: swipe the top card (either direction) for the next word, `←` `→` keys, or the Prev / Next buttons. Deck animation uses [motion](https://motion.dev) (framer-motion).

## Deploy (GitHub Pages)

1. Push the repo to GitHub (default branch `main`).
2. Repo → Settings → Pages → Source: **GitHub Actions**.
3. Every push to `main` runs `.github/workflows/deploy.yml`, which builds with bun and publishes `dist/`.

The workflow sets `BASE_PATH=/<repo-name>/` so assets resolve under the project URL. If you deploy to a user site (`<user>.github.io` repo) or a custom domain, set `BASE_PATH=/` in the workflow instead.

## Word list

`src/words.ts` is the 500 words that appear in the most rock songs, by document frequency (share of songs
containing the word at least once), with stopwords and filler removed. `data/words.csv` has the full ranking with counts.

Data: the [musiXmatch dataset](http://millionsongdataset.com/musixmatch/) (bag-of-words lyrics for 237k Million Song
Dataset tracks, top 5,000 stemmed words) plus [tagtraum CD2 genre annotations](http://www.tagtraum.com/msd_genre_datasets.html).
61,532 of the 113,150 Rock-tagged tracks have lyrics.

To regenerate, download these four files into one directory and run the script (no dependencies beyond Python 3):

```sh
# http://millionsongdataset.com/sites/default/files/AdditionalFiles/mxm_dataset_train.txt.zip
# http://millionsongdataset.com/sites/default/files/AdditionalFiles/mxm_dataset_test.txt.zip
# http://millionsongdataset.com/sites/default/files/mxm_reverse_mapping.txt
# http://www.tagtraum.com/genres/msd_tagtraum_cd2.cls.zip
python3 -I scripts/build-words.py --data <dir> --genre Rock --top 500
```

`--genre` is repeatable (tagtraum genres: Rock, Pop, Metal, Punk, Rap, RnB, Country, Electronic, Jazz, Blues, Folk,
Reggae, Latin, World, New Age). Stopword and filler lists live at the top of the script.
