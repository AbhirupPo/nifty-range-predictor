function formatNumber(x) {
  return Math.round(x).toLocaleString('en-IN');
}

function percentile(sortedArr, p) {
  const idx = (sortedArr.length - 1) * p;
  const lower = Math.floor(idx);
  const upper = Math.ceil(idx);
  if (lower === upper) return sortedArr[lower];
  return sortedArr[lower] + (sortedArr[upper] - sortedArr[lower]) * (idx - lower);
}

function randn() {
  let u = 0;
  let v = 0;
  while (u === 0) u = Math.random();
  while (v === 0) v = Math.random();
  return Math.sqrt(-2.0 * Math.log(u)) * Math.cos(2.0 * Math.PI * v);
}

function simpleMultimodalModel(spot, days, vix) {
  const dailyDrift = 0.0004;
  const baseDailyVol = 0.009;
  const vixScaler = 1 + (vix - 15) * 0.025;
  const horizonVol = baseDailyVol * Math.sqrt(days) * Math.max(0.6, vixScaler);
  const expected = spot * (1 + dailyDrift * days);
  const lower = expected * (1 - 1.28 * horizonVol);
  const upper = expected * (1 + 1.28 * horizonVol);
  return {
    lower,
    upper,
    expected,
    confidence: 'Approx. 80% interval'
  };
}

const baseTransition = [
  [0.70, 0.25, 0.05],
  [0.20, 0.60, 0.20],
  [0.05, 0.30, 0.65]
];

const lowVixTransition = [
  [0.77, 0.20, 0.03],
  [0.25, 0.55, 0.20],
  [0.08, 0.27, 0.65]
];

const highVixTransition = [
  [0.55, 0.30, 0.15],
  [0.25, 0.45, 0.30],
  [0.12, 0.28, 0.60]
];

const stateReturns = {
  0: { mean: -0.006, vol: 0.012 },
  1: { mean: 0.0003, vol: 0.007 },
  2: { mean: 0.006, vol: 0.011 }
};

function drawNextState(currentState, transitionMatrix) {
  const u = Math.random();
  let cumulative = 0;
  for (let j = 0; j < transitionMatrix[currentState].length; j++) {
    cumulative += transitionMatrix[currentState][j];
    if (u <= cumulative) return j;
  }
  return transitionMatrix[currentState].length - 1;
}

function monteCarloMarkov(spot, days, simulations, transitionMatrix, startState = 1) {
  const terminalPrices = [];

  for (let i = 0; i < simulations; i++) {
    let price = spot;
    let state = startState;

    for (let d = 0; d < days; d++) {
      state = drawNextState(state, transitionMatrix);
      const params = stateReturns[state];
      const dailyReturn = params.mean + params.vol * randn();
      price *= (1 + dailyReturn);
    }

    terminalPrices.push(price);
  }

  terminalPrices.sort((a, b) => a - b);

  return {
    lower: percentile(terminalPrices, 0.10),
    median: percentile(terminalPrices, 0.50),
    upper: percentile(terminalPrices, 0.90),
    samples: terminalPrices
  };
}

function updateResultCard(rangeId, metaId, result, label) {
  document.getElementById(rangeId).textContent = `${formatNumber(result.lower)} - ${formatNumber(result.upper)}`;
  document.getElementById(metaId).innerHTML = `
    Central estimate: <strong>${formatNumber(result.expected || result.median)}</strong><br>
    ${label}
  `;
}

function renderChart(simple, markov, vixMarkov) {
  const traces = [
    {
      x: ['Lower', 'Central', 'Upper'],
      y: [simple.lower, simple.expected, simple.upper],
      type: 'bar',
      name: 'Simple Model'
    },
    {
      x: ['Lower', 'Central', 'Upper'],
      y: [markov.lower, markov.median, markov.upper],
      type: 'bar',
      name: 'Markov + MC'
    },
    {
      x: ['Lower', 'Central', 'Upper'],
      y: [vixMarkov.lower, vixMarkov.median, vixMarkov.upper],
      type: 'bar',
      name: 'VIX-Conditioned Markov + MC'
    }
  ];

  const layout = {
    title: 'Model Range Comparison',
    paper_bgcolor: 'rgba(0,0,0,0)',
    plot_bgcolor: 'rgba(0,0,0,0)',
    font: { color: '#edf2ff' },
    yaxis: { title: 'Predicted NIFTY Level' },
    xaxis: { title: 'Range Point' },
    margin: { t: 50, r: 20, b: 50, l: 70 }
  };

  Plotly.newPlot('chart', traces, layout, { responsive: true });
}

function runModels() {
  const days = Number(document.getElementById('daysInput').value);
  const spot = Number(document.getElementById('spotInput').value);
  const vix = Number(document.getElementById('vixInput').value);

  const simple = simpleMultimodalModel(spot, days, vix);
  const markov = monteCarloMarkov(spot, days, 4000, baseTransition, 1);
  const transitionMatrix = vix >= 18 ? highVixTransition : lowVixTransition;
  const vixMarkov = monteCarloMarkov(spot, days, 4000, transitionMatrix, 1);

  updateResultCard('simpleRange', 'simpleMeta', simple, simple.confidence);
  updateResultCard('markovRange', 'markovMeta', markov, '10th to 90th percentile from 4,000 simulations');
  updateResultCard('vixRange', 'vixMeta', vixMarkov, `10th to 90th percentile from 4,000 simulations | VIX regime: ${vix >= 18 ? 'High' : 'Low/Normal'}`);

  renderChart(simple, markov, vixMarkov);
}

document.getElementById('runBtn').addEventListener('click', runModels);
window.addEventListener('load', runModels);
