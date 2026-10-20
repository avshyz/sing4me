# Sing4Me

Party game: a word is shown, first player to name a song containing that word wins the round.

```sh
bun install
bun run dev      # http://localhost:5173
bun run build    # static output in dist/
```

Words come from a curated list in `src/words.ts` (no lyrics database). Edit that file to add or remove words.

Controls: swipe the top card (either direction) for the next word, `←` `→` keys, or the Prev / Next buttons. Deck animation uses [motion](https://motion.dev) (framer-motion).
