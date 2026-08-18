const { loadState, saveState, findSession } = require('./lib/state');
const { GlimmerTrainer } = require('./lib/trainer');

let trainer = null;

function getTrainer() {
  if (!trainer) {
    trainer = new GlimmerTrainer();
    const state = loadState();
    if (state.training) {
      trainer.loadState(state.training);
    }
  }
  return trainer;
}

function saveTrainingState(trainer, state) {
  state.training = {
    isTraining: trainer.isTraining,
    startedAt: trainer.startedAt || state.training?.startedAt || null,
    currentStep: trainer.currentStep,
    totalSteps: trainer.totalSteps,
    loss: trainer.lossHistory.length > 0 ? trainer.lossHistory[trainer.lossHistory.length - 1] : null,
    accuracy: trainer.accuracyHistory.length > 0 ? trainer.accuracyHistory[trainer.accuracyHistory.length - 1] : 0,
    weights: trainer.model ? trainer.model.serialize() : null,
    converged: trainer.converged,
    lossHistory: trainer.lossHistory.slice(-50),
    accuracyHistory: trainer.accuracyHistory.slice(-50)
  };
  saveState(state);
}

module.exports = (req, res) => {
  const urlParts = req.url.split('?');
  const params = new URLSearchParams(urlParts[1] || '');
  const operation = params.get('op') || (req.method === 'GET' ? 'state' : 'step');

  const token = req.headers.authorization?.replace('Bearer ', '');

  const handleAuthed = (callback) => {
    if (!token) {
      return res.status(401).json({ error: 'Authorization token required' });
    }
    const session = findSession(token);
    if (!session) {
      return res.status(401).json({ error: 'Invalid or expired session' });
    }
    callback(session);
  };

  if (operation === 'state' && req.method === 'GET') {
    return handleAuthed((session) => {
      const t = getTrainer();
      const state = loadState();
      res.status(200).json({
        training: t.getState(),
        account: { id: session.userId, step: t.currentStep }
      });
    });
  }

  if (operation === 'start' && req.method === 'POST') {
    return handleAuthed((session) => {
      const t = getTrainer();
      t.isTraining = true;
      if (!t.startedAt) t.startedAt = new Date().toISOString();
      t.totalSteps = 1000;
      const state = loadState();
      saveTrainingState(t, state);
      res.status(200).json({ started: true, message: 'Auto-training started', totalSteps: t.totalSteps });
    });
  }

  if (operation === 'step' && req.method === 'POST') {
    return handleAuthed((session) => {
      const t = getTrainer();
      let body = '';
      req.on('data', chunk => body += chunk);
      req.on('end', () => {
        let steps = 50;
        try {
          const data = JSON.parse(body || '{}');
          steps = data.steps || 50;
        } catch (e) {}

        const result = t.autoTrain(steps);
        const state = loadState();
        saveTrainingState(t, state);

        res.status(200).json({
          ...result,
          currentStep: t.currentStep,
          isTraining: t.isTraining
        });
      });
    });
  }

  if (operation === 'stop' && req.method === 'POST') {
    return handleAuthed((session) => {
      const t = getTrainer();
      t.isTraining = false;
      const state = loadState();
      saveTrainingState(t, state);
      res.status(200).json({ stopped: true, message: 'Training stopped' });
    });
  }

  if (operation === 'weights' && req.method === 'GET') {
    return handleAuthed((session) => {
      const t = getTrainer();
      res.status(200).json({ weights: t.model ? t.model.serialize() : null, step: t.currentStep });
    });
  }

  res.status(400).json({ error: 'Invalid operation. Use ?op=state, start, step, stop, or weights.' });
};