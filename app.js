async function loadJSON(path) {
  const res = await fetch(path);
  if (!res.ok) {
    throw new Error(`Failed to load ${path}`);
  }
  return await res.json();
}

function percentile(arr, p) {
  if (!arr.length) return NaN;
  const sorted = [...arr].sort((a, b) => a - b);
  const idx = (p / 100) * (sorted.length - 1);
  const lower = Math.floor(idx);
  const upper = Math.ceil(idx);
  if (lower === upper) return sorted[lower];
  return sorted[lower] + (sorted[upper] - sorted[lower]) * (idx - lower);
}

function randomChoice(arr) {
  return arr[Math.floor(Math.random() * arr.length)];
}

function weightedChoice(values, probs) {
  const r = Math.random();
  let cum = 0;
  for (let i = 0; i < values.length; i++) {
    cum += probs[i];
    if (r <= cum) return values[i];
  }
  return values[values.length - 1];
}

function mapToBucket(value, binEdges) {
  for (let i = 1; i < binEdges.length; i++) {
    if (value <= binEdges[i]) return i;
  }
  return binEdges.length - 1;
}

function cumulativeLogToPrice(spot, logRet) {
  return spot * Math.exp(logRet);
}

function formatNum(x) {
  return Number(x).toFixed(2);
}

function buildStats(spot, terminalDist) {
  const p15 = percentile(terminalDist, 15);
  const p50 = percentile(terminalDist, 50);
  const p85 = percentile(terminalDist, 85);

  const lowerPrice = cumulativeLogToPrice(spot, p15);
  const medianPrice = cumulativeLogToPrice(spot, p50);
  const upperPrice = cumulativeLogToPrice(spot, p85);

  const lowerBandPct = ((lowerPrice / spot) - 1) * 100;
  const upperBandPct = ((upperPrice / spot) - 1) * 100;
  const totalWidthPct = ((upperPrice - lowerPrice) / spot) * 100;

  return {
    p15,
    p50,
    p85,
    lowerPrice,
    medianPrice,
    upperPrice,
    lowerBandPct,
    upperBandPct,
    totalWidthPct
  };
}

function simulateModel1(model1, nDays, nSims) {
  const deciles = model1.return_deciles;
  const probs = model1.return_decile_probabilities;
  const returnsByDecile = model1.returns_by_decile;

  const terminal = [];

  for (let s = 0; s < nSims; s++) {
    let cum = 0;
    for (let d = 0; d < nDays; d++) {
      const chosenDecile = weightedChoice(deciles, probs);
      const sampledReturn = randomChoice(returnsByDecile[String(chosenDecile)]);
      cum += sampledReturn;
    }
    terminal.push(cum);
  }

  return terminal;
}

function simulateModel2(model2, nDays, nSims, currentReturn) {
  const returnBinEdges = model2.return_bin_edges;
  const states = model2.transition_states;
  const matrix = model2.transition_matrix;
  const returnsByDecile = model2.returns_by_decile;

  let currentState = mapToBucket(currentReturn, returnBinEdges);

  const terminal = [];

  for (let s = 0; s < nSims; s++) {
    let state = currentState;
    let cum = 0;

    for (let d = 0; d < nDays; d++) {
      const probs = matrix[state - 1];
      const nextState = weightedChoice(states, probs);
      const sampledReturn = randomChoice(returnsByDecile[String(nextState)]);
      cum += sampledReturn;
      state = nextState;
    }

    terminal.push(cum);
  }

  return terminal;
}

function simulateModel3(model3, nDays, nSims, currentReturn, currentVix) {
  const returnBinEdges = model3.return_bin_edges;
  const vixBinEdges = model3.vix_bin_edges;
  const jointStates = model3.joint_states;
  const matrix = model3.transition_matrix;
  const returnsByJointState = model3.returns_by_joint_state;
  const returnsByDecileFallback = model3.returns_by_decile_fallback;
  const stateToDecile = model3.state_to_decile;
  const minObsPerState = model3.min_obs_per_state;

  const currentReturnDecile = mapToBucket(currentReturn, returnBinEdges);
  const currentVixBucket = mapToBucket(currentVix, vixBinEdges);
  const startState = (currentVixBucket - 1) * 10 + currentReturnDecile;

  const terminal = [];

  for (let s = 0; s < nSims; s++) {
    let state = startState;
    let cum = 0;

    for (let d = 0; d < nDays; d++) {
      const probs = matrix[state - 1];
      const nextState = weightedChoice(jointStates, probs);

      let stateReturns = returnsByJointState[String(nextState)];
      if (!stateReturns || stateReturns.length < minObsPerState) {
        const fallbackDecile = stateToDecile[String(nextState)];
        stateReturns = returnsByDecileFallback[String(fallbackDecile)];
      }

      const sampledReturn = randomChoice(stateReturns);
      cum += sampledReturn;
      state = nextState;
    }

    terminal.push(cum);
  }

  return terminal;
}

function renderCard(cardId, title, stats) {
  const el = document.getElementById(cardId);
  if (!el) return;

  el.innerHTML = `
    <h3>${title}</h3>
    <p><strong>15th percentile:</strong> ${formatNum(stats.lowerPrice)}</p>
    <p><strong>Median:</strong> ${formatNum(stats.medianPrice)}</p>
    <p><strong>85th percentile:</strong> ${formatNum(stats.upperPrice)}</p>
    <p><strong>Lower band %:</strong> ${formatNum(stats.lowerBandPct)}%</p>
    <p><strong>Upper band %:</strong> ${formatNum(stats.upperBandPct)}%</p>
    <p><strong>Total band width %:</strong> ${formatNum(stats.totalWidthPct)}%</p>
  `;
}

function renderMetadata(metadata) {
  const el = document.getElementById("metadata");
  if (!el) return;

  el.innerHTML = `
    <p><strong>Last updated:</strong> ${metadata.last_updated}</p>
    <p><strong>Training window:</strong> ${metadata.training_start} to ${metadata.training_end}</p>
    <p><strong>Rows used:</strong> ${metadata.rows_used_for_modelling}</p>
  `;
}

function renderChart(dist1, dist2, dist3) {
  const chartEl = document.getElementById("chart");
  if (!chartEl || typeof Plotly === "undefined") return;

  const traces = [
    {
      x: dist1,
      type: "histogram",
      name: "Model 1",
      opacity: 0.5,
      histnorm: "probability density"
    },
    {
      x: dist2,
      type: "histogram",
      name: "Model 2",
      opacity: 0.5,
      histnorm: "probability density"
    },
    {
      x: dist3,
      type: "histogram",
      name: "Model 3",
      opacity: 0.5,
      histnorm: "probability density"
    }
  ];

  const layout = {
    title: "Forecast Distributions",
    barmode: "overlay",
    xaxis: { title: "Cumulative Log Return" },
    yaxis: { title: "Density" }
  };

  Plotly.newPlot(chartEl, traces, layout, { responsive: true });
}

async function main() {
  const [model1, model2, model3, metadata] = await Promise.all([
    loadJSON("data/model1.json"),
    loadJSON("data/model2.json"),
    loadJSON("data/model3.json"),
    loadJSON("data/metadata.json")
  ]);

  renderMetadata(metadata);

  const btn = document.getElementById("runForecast");

  btn.addEventListener("click", () => {
    const nDays = parseInt(document.getElementById("days").value, 10);
    const currentNifty = parseFloat(document.getElementById("spot").value);
    const previousClose = parseFloat(document.getElementById("prevClose").value);
    const currentVix = parseFloat(document.getElementById("vix").value);

    if (
      Number.isNaN(nDays) ||
      Number.isNaN(currentNifty) ||
      Number.isNaN(previousClose) ||
      Number.isNaN(currentVix) ||
      nDays <= 0
    ) {
      alert("Please enter valid inputs.");
      return;
    }

    const currentReturn = Math.log(currentNifty / previousClose);
    const nSims = 5000;

    const dist1 = simulateModel1(model1, nDays, nSims);
    const dist2 = simulateModel2(model2, nDays, nSims, currentReturn);
    const dist3 = simulateModel3(model3, nDays, nSims, currentReturn, currentVix);

    const stats1 = buildStats(currentNifty, dist1);
    const stats2 = buildStats(currentNifty, dist2);
    const stats3 = buildStats(currentNifty, dist3);

    renderCard("model1Card", "Model 1: Unconditional Empirical Monte Carlo", stats1);
    renderCard("model2Card", "Model 2: Return-Decile Markov Monte Carlo", stats2);
    renderCard("model3Card", "Model 3: Joint Return/VIX Markov Monte Carlo", stats3);

    renderChart(dist1, dist2, dist3);
  });
}

main().catch(err => {
  console.error(err);
  alert("Failed to load model files. Check your data folder and file paths.");
});
