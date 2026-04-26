# NIFTY Range Predictor

A simple GitHub Pages website that lets a user enter:
- forecast horizon in days
- current NIFTY spot
- India VIX

It then returns three prediction ranges:
1. Simple multimodal model
2. Markov chain + Monte Carlo
3. VIX-conditioned Markov chain + Monte Carlo

## Files
- `index.html` - app layout
- `styles.css` - styling
- `app.js` - model logic and chart rendering

## Important
The website only needs the JSON files in `data/`. Keep any data-fetching scripts,
API keys, access tokens, and `.env` files outside this public repository.

Recommended local workflow:

1. Run your private model-generation script from a sibling private folder.
2. Have that script write updated JSON files into this repo's `data/` folder.
3. Commit and push only the public-safe website files and generated JSON outputs.

Example local layout:

```text
Algorithmic Trading/
  nifty-range-predictor/
    index.html
    styles.css
    app.js
    data/
      model1.json
      model2.json
      model3.json
      metadata.json

  nifty-range-predictor-private/
    generate_models.py
    .env
```

To publish refreshed model data:

```powershell
cd "C:\Users\spodd\OneDrive\Desktop\Algorithmic Trading\nifty-range-predictor"
git add data/
git commit -m "Update model data"
git push
```
