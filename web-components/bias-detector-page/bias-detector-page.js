const applicationModule = require('assistos').loadModule('application', {});

export class BiasDetectorPage {
    constructor(element, invalidate) {
        this.element = element;
        this.invalidate = invalidate;
        this.biasService = null;
        this.visualizationService = null;
        this.invalidate();
    }

    async beforeRender() {
        // Get services
        this.biasService = window.services.get('BiasAnalysisService');
        this.visualizationService = window.services.get('VisualizationService');
    }

    async afterRender() {
        // Setup and start analysis
        this.setupEventListeners();
        await this.analyze();
    }

    setupEventListeners() {
        const backBtn = this.element.querySelector('#backBtn');
        backBtn.addEventListener('click', () => {
            RoutingService.navigateInternal('bias-detector-landing', {});
        });
    }

    async analyze() {
        try {
            const personality = this.element.getAttribute('data-personality');
            const prompt = this.element.getAttribute('data-prompt');
            const text = this.element.getAttribute('data-text');
            const topBiases = parseInt(this.element.getAttribute('data-top-biases'));

            // Set loading state
            this.showLoading(true);

            // Analyze text
            this.biasService.setPersonality(personality);
            const biasResults = await this.biasService.analyzeText(text, topBiases);

            // Generate visualization
            const visualization = this.visualizationService.generateQuadrantVisualization(biasResults);
            this.element.querySelector('#visualizationContainer').innerHTML = visualization;

            // Display results
            this.displayBiases(biasResults);
            this.displayExplanations(biasResults);

        } catch (error) {
            console.error('Error during analysis:', error);
            this.showError('An error occurred during analysis');
        } finally {
            this.showLoading(false);
        }
    }

    displayBiases(results) {
        const container = this.element.querySelector('#biasListContainer');
        container.innerHTML = results.biases.map(bias => `
            <div class="bias-item">
                <div class="bias-name">${bias.name}</div>
                <div class="bias-score">Score: ${bias.score.toFixed(2)}</div>
                <div class="counter-bias">Counter-bias: ${bias.counterBias}</div>
            </div>
        `).join('');
    }

    displayExplanations(results) {
        const container = this.element.querySelector('#explanationContainer');
        container.innerHTML = results.explanations.map((explanation, index) => `
            <div class="explanation">
                <h3>${results.biases[index].name}</h3>
                <p>${explanation}</p>
            </div>
        `).join('');
    }

    showLoading(isLoading) {
        const containers = ['#visualizationContainer', '#biasListContainer', '#explanationContainer'];
        containers.forEach(selector => {
            const container = this.element.querySelector(selector);
            if (isLoading) {
                container.innerHTML = '<div class="loading">Analyzing...</div>';
            }
        });
    }

    showError(message) {
        const containers = ['#visualizationContainer', '#biasListContainer', '#explanationContainer'];
        containers.forEach(selector => {
            const container = this.element.querySelector(selector);
            container.innerHTML = `<div class="error">${message}</div>`;
        });
    }
} 