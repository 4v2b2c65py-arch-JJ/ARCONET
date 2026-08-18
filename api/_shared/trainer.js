const crypto = require('crypto');
const fs = require('fs');

let glimmerVM = null;
let glimmerTemplates = null;

try {
  const glimmer = require('@glimmer/vm');
  glimmerVM = glimmer;
} catch (e) {
  glimmerVM = null;
}

class SimpleNeuralNet {
  constructor(inputSize, hiddenSize, outputSize) {
    this.weightsIH = this.randomMatrix(inputSize, hiddenSize);
    this.biasH = this.randomArray(hiddenSize);
    this.weightsHO = this.randomMatrix(hiddenSize, outputSize);
    this.biasO = this.randomArray(outputSize);
    this.learningRate = 0.01;
  }

  randomMatrix(rows, cols) {
    return Array.from({ length: rows }, () =>
      Array.from({ length: cols }, () => (Math.random() * 2 - 1) * 0.5)
    );
  }

  randomArray(size) {
    return Array.from({ length: size }, () => (Math.random() * 2 - 1) * 0.5);
  }

  static sigmoid(x) {
    return 1 / (1 + Math.exp(-Math.max(-500, Math.min(500, x))));
  }

  static dsigmoid(y) {
    return y * (1 - y);
  }

  forward(input) {
    const hidden = this.weightsIH[0].map((_, j) =>
      this.biasH[j] + input.reduce((sum, val, i) => sum + val * this.weightsIH[i][j], 0)
    ).map(v => SimpleNeuralNet.sigmoid(v));

    const output = this.weightsHO[0].map((_, j) =>
      this.biasO[j] + hidden.reduce((sum, val, i) => sum + val * this.weightsHO[i][j], 0)
    ).map(v => SimpleNeuralNet.sigmoid(v));

    return { hidden, output };
  }

  train(input, target) {
    const { hidden, output } = this.forward(input);
    const errors = target.map((t, i) => t - output[i]);

    const outDelta = errors.map((e, i) => e * SimpleNeuralNet.dsigmoid(output[i]));

    for (let i = 0; i < hidden.length; i++) {
      for (let j = 0; j < output.length; j++) {
        this.weightsHO[i][j] += this.learningRate * outDelta[j] * hidden[i];
      }
      this.biasO[j] = (this.biasO[j] || 0) + this.learningRate * outDelta[i];
    }

    const hiddenErrors = hidden.map((h, i) =>
      outDelta.reduce((sum, delta, j) => sum + delta * this.weightsHO[i][j], 0)
    );

    const hiddenDelta = hiddenErrors.map((e, i) => e * SimpleNeuralNet.dsigmoid(hidden[i]));

    for (let i = 0; i < input.length; i++) {
      for (let j = 0; j < hidden.length; j++) {
        this.weightsIH[i][j] += this.learningRate * hiddenDelta[j] * input[i];
      }
    }

    for (let j = 0; j < hidden.length; j++) {
      this.biasH[j] += this.learningRate * hiddenDelta[j];
    }

    const loss = errors.reduce((sum, e) => sum + e * e, 0) / target.length;
    return { loss, output };
  }

  serialize() {
    return {
      weightsIH: this.weightsIH,
      biasH: this.biasH,
      weightsHO: this.weightsHO,
      biasO: this.biasO,
      learningRate: this.learningRate
    };
  }

  static deserialize(data) {
    const net = Object.create(SimpleNeuralNet.prototype);
    net.weightsIH = data.weightsIH;
    net.biasH = data.biasH;
    net.weightsHO = data.weightsHO;
    net.biasO = data.biasO;
    net.learningRate = data.learningRate;
    return net;
  }
}

class GlimmerTrainer {
  constructor() {
    this.model = null;
    this.isTraining = false;
    this.currentStep = 0;
    this.totalSteps = 1000;
    this.lossHistory = [];
    this.accuracyHistory = [];
    this.lastLoss = null;
    this.targetLoss = 0.001;
  }

  generateTemplate() {
    const templates = [
      '<div>{{greeting}}, {{name}}!</div>',
      '<div class="{{status}}">{{message}}</div>',
      '<h1>{{title}}</h1><p>{{content}}</p>',
      '<span class="badge {{type}}">{{count}}</span>',
      '<div data-id="{{id}}" data-status="{{state}}">{{label}}</div>',
      '<ul>{{#each items as |item|}}<li>{{item}}</li>{{/each}}</ul>',
      '<div>{{#if isActive}}Active{{else}}Inactive{{/if}}</div>',
      '<a href="{{url}}">{{text}}</a>'
    ];
    return templates[Math.floor(Math.random() * templates.length)];
  }

  generateContext() {
    const contexts = [
      { greeting: 'Hello', name: 'World', status: 'online', message: 'All systems operational' },
      { title: 'System Alert', content: 'Recovery protocol initiated', status: 'warning' },
      { type: 'badge', count: 42, status: 'active' },
      { id: 'DEV-001', state: 'ready', label: 'Device Ready' },
      { items: ['Apple', 'Banana', 'Cherry'], status: 'list' },
      { isActive: true, status: 'power' },
      { url: '/dashboard', text: 'Go to Dashboard' }
    ];
    return contexts[Math.floor(Math.random() * contexts.length)];
  }

  generateExpectedOutput(template, context) {
    let output = template;
    for (const key of Object.keys(context)) {
      const value = context[key];
      if (Array.isArray(value)) {
        let items = '';
        value.forEach(v => items += `<li>${v}</li>`);
        output = output.replace('{{#each items as |item|}}<li>{{item}}</li>{{/each}}', items);
      } else if (typeof value === 'boolean') {
        const boolTemplate = output.match(/\{\{#if ([^}]+)\}\}([^}]+)\{\{else\}\}([^]+?)\{\{\/if\}\}/);
        if (boolTemplate) {
          const replacement = value ? boolTemplate[2] : boolTemplate[3];
          output = output.replace(boolTemplate[0], replacement);
        }
      } else {
        output = output.replace(new RegExp(`{{${key}}}`, 'g'), value);
      }
    }
    return output;
  }

  async tryRenderWithGlimmer(template, context) {
    if (!glimmerVM) {
      return this.generateExpectedOutput(template, context);
    }
    try {
      const { compile, render } = glimmerVM;
      const compiled = compile(template);
      const result = render(compiled, context);
      return result;
    } catch (e) {
      return this.generateExpectedOutput(template, context);
    }
  }

  getContextVector(context) {
    const keys = ['greeting', 'name', 'status', 'message', 'title', 'content',
                  'type', 'count', 'id', 'state', 'label', 'url', 'text',
                  'isActive'];
    const vector = keys.map(k => {
      const val = context[k];
      if (typeof val === 'string') return val.split('').reduce((a, c) => a + c.charCodeAt(0), 0) / 1000;
      if (typeof val === 'number') return val / 100;
      if (typeof val === 'boolean') return val ? 1 : 0;
      return 0;
    });
    while (vector.length < 16) vector.push(0);
    return vector.slice(0, 16);
  }

  getTargetVector(context, template) {
    const hash = crypto.createHash('sha256').update(template).digest('hex');
    const target = Array.from(hash.slice(0, 8)).map(c => parseInt(c, 16) / 15);
    while (target.length < 8) target.push(0);
    return target;
  }

  initialize() {
    if (!this.model) {
      this.model = new SimpleNeuralNet(16, 8, 8);
    }
    this.currentStep = 0;
    this.lossHistory = [];
    this.accuracyHistory = [];
    this.isTraining = false;
    this.lastLoss = null;
    this.totalSteps = 1000;
  }

  step() {
    if (!this.model) this.initialize();

    const template = this.generateTemplate();
    const context = this.generateContext();
    const target = this.getTargetVector(context, template);
    const input = this.getContextVector(context);

    const result = this.model.train(input, target);

    this.currentStep++;
    this.lossHistory.push(result.loss);
    this.lastLoss = result.loss;
    this.accuracyHistory.push(
      target.reduce((sum, t, i) => sum + (Math.abs(t - result.output[i]) < 0.3 ? 1 : 0), 0) / target.length
    );

    return {
      step: this.currentStep,
      loss: result.loss,
      accuracy: this.accuracyHistory[this.accuracyHistory.length - 1],
      template,
      context,
      output: result.output
    };
  }

  autoTrain(steps = 50) {
    const results = [];
    for (let i = 0; i < steps; i++) {
      const result = this.step();
      results.push(result);
      if (this.lastLoss !== null && this.lastLoss < this.targetLoss) {
        this.converge();
        break;
      }
    }

    const recentLoss = this.lossHistory.slice(-10);
    const avgLoss = recentLoss.reduce((a, b) => a + b, 0) / recentLoss.length;
    const recentAcc = this.accuracyHistory.slice(-10);
    const avgAcc = recentAcc.reduce((a, b) => a + b, 0) / recentAcc.length;

    return {
      stepsCompleted: results.length,
      currentStep: this.currentStep,
      loss: avgLoss,
      accuracy: avgAcc,
      converged: this.lastLoss !== null && this.lastLoss < this.targetLoss,
      lastLoss: this.lastLoss,
      weights: this.model ? this.model.serialize() : null
    };
  }

  converge() {
    this.converged = true;
    this.isTraining = false;
  }

  getState() {
    return {
      isTraining: this.isTraining,
      currentStep: this.currentStep,
      totalSteps: this.totalSteps,
      loss: this.lossHistory.length > 0 ? this.lossHistory[this.lossHistory.length - 1] : null,
      accuracy: this.accuracyHistory.length > 0 ? this.accuracyHistory[this.accuracyHistory.length - 1] : 0,
      converged: this.converged,
      weights: this.model ? this.model.serialize() : null,
      lossHistory: this.lossHistory.slice(-50),
      accuracyHistory: this.accuracyHistory.slice(-50),
      glimmerAvailable: glimmerVM !== null
    };
  }

  loadState(state) {
    if (state.weights && !this.model) {
      this.model = SimpleNeuralNet.deserialize(state.weights);
    } else if (state.weights && this.model) {
      this.model.weightsIH = state.weights.weightsIH;
      this.model.biasH = state.weights.biasH;
      this.model.weightsHO = state.weights.weightsHO;
      this.model.biasO = state.weights.biasO;
      this.model.learningRate = state.weights.learningRate;
    }
    this.currentStep = state.currentStep || 0;
    this.lossHistory = state.lossHistory || [];
    this.accuracyHistory = state.accuracyHistory || [];
    this.isTraining = state.isTraining || false;
    this.converged = state.converged || false;
    this.lastLoss = state.loss || null;
  }

  static generateTrainingData(template, context, expected) {
    return { template, context, expected };
  }
}

module.exports = { SimpleNeuralNet, GlimmerTrainer, glimmerVM };