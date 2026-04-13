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

## How to publish on GitHub Pages
1. Create a new GitHub repository.
2. Upload these files to the root of the repo.
3. Go to **Settings > Pages**.
4. Under **Build and deployment**, choose **Deploy from a branch**.
5. Select the `main` branch and `/root` folder.
6. Save and wait for the site URL to appear.

## Important
The current model values are placeholders for demonstration.
Replace them with your own estimated model parameters from NIFTY historical data.
