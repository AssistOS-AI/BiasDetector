export class BiasDetectorResults {
    constructor(element, invalidate) {
        this.element = element;
        this.invalidate = invalidate;
        this.results = null;
        this.invalidate();
    }

    async beforeRender() {
        // Initialize if results are present
        const resultsData = this.element.getAttribute('data-results');
        if (resultsData) {
            try {
                this.results = JSON.parse(resultsData);
            } catch (error) {
                console.error('Error parsing results data:', error);
            }
        }
    }

    async afterRender() {
        if (this.results) {
            this.updateResults();
        }
    }

    updateResults() {
        if (!this.results) return;

        const container = this.element.querySelector('#biasResults');
        container.innerHTML = this.results.biases.map((bias, index) => `
            <div class="bias-section">
                <div class="bias-header">
                    <div>
                        <div class="bias-name">${bias.name}</div>
                        <div class="counter-bias">Counter-bias: ${bias.counterBias}</div>
                    </div>
                    <div class="bias-score">Score: ${bias.score.toFixed(2)}</div>
                </div>
                <div class="explanation">
                    <h4>Analysis</h4>
                    <p>${this.results.explanations[index]}</p>
                </div>
                <button class="edit-button" data-index="${index}">
                    Edit Bias
                </button>
            </div>
        `).join('');

        this.setupEventListeners();
    }

    setupEventListeners() {
        const editButtons = this.element.querySelectorAll('.edit-button');
        editButtons.forEach(button => {
            button.addEventListener('click', (e) => {
                const index = parseInt(e.target.getAttribute('data-index'));
                const bias = this.results.biases[index];
                this.element.dispatchEvent(new CustomEvent('edit-bias', {
                    detail: {
                        bias,
                        index,
                        explanation: this.results.explanations[index]
                    },
                    bubbles: true,
                    composed: true
                }));
            });
        });
    }
} 