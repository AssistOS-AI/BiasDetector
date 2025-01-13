export class BiasDetectorVisualization {
    constructor(element, invalidate) {
        this.element = element;
        this.invalidate = invalidate;
        this.data = null;
        this.invalidate();
    }

    async beforeRender() {
        // Initialize if data is present
        const biasesData = this.element.getAttribute('data-biases');
        if (biasesData) {
            try {
                this.data = JSON.parse(biasesData);
            } catch (error) {
                console.error('Error parsing bias data:', error);
            }
        }
    }

    async afterRender() {
        if (this.data) {
            this.updateVisualization();
        }
    }

    updateVisualization() {
        if (!this.data) return;

        const svg = this.element.querySelector('#biasVisualization');
        const width = svg.clientWidth;
        const height = svg.clientHeight;
        const centerX = width / 2;
        const centerY = height / 2;
        const radius = Math.min(width, height) * 0.4;

        // Draw quadrant lines
        const quadrants = this.element.querySelector('#quadrants');
        quadrants.innerHTML = `
            <line class="quadrant-line" x1="${centerX}" y1="0" x2="${centerX}" y2="${height}"/>
            <line class="quadrant-line" x1="0" y1="${centerY}" x2="${width}" y2="${centerY}"/>
        `;

        // Draw axes
        const axes = this.element.querySelector('#axes');
        axes.innerHTML = `
            <line class="axis-line" x1="0" y1="${centerY}" x2="${width}" y2="${centerY}" marker-end="url(#arrow)"/>
            <line class="axis-line" x1="${centerX}" y1="${height}" x2="${centerX}" y2="0" marker-end="url(#arrow)"/>
        `;

        // Plot bias points
        const points = this.element.querySelector('#points');
        const labels = this.element.querySelector('#labels');
        points.innerHTML = '';
        labels.innerHTML = '';

        this.data.forEach((bias, index) => {
            const angle = (bias.quadrant - 1) * Math.PI / 2;
            const x = centerX + Math.cos(angle) * radius * bias.score;
            const y = centerY - Math.sin(angle) * radius * bias.score;

            // Add point
            points.innerHTML += `
                <circle class="bias-point" cx="${x}" cy="${y}" r="5" 
                    fill="#007bff" data-index="${index}"/>
            `;

            // Add label
            labels.innerHTML += `
                <text class="bias-label" x="${x + 10}" y="${y + 5}">${bias.name}</text>
            `;
        });

        // Add event listeners for interactivity
        this.setupPointInteraction();
    }

    setupPointInteraction() {
        const points = this.element.querySelectorAll('.bias-point');
        const tooltip = this.element.querySelector('#tooltip');
        
        points.forEach(point => {
            point.addEventListener('mouseover', (e) => {
                const index = e.target.getAttribute('data-index');
                const bias = this.data[index];
                
                // Update tooltip content
                tooltip.innerHTML = `
                    <div class="tooltip-title">${bias.name}</div>
                    <div class="tooltip-score">Score: ${(bias.score * 100).toFixed(1)}%</div>
                    <div class="tooltip-explanation">${bias.explanation}</div>
                `;
                
                // Position tooltip near the point
                const rect = e.target.getBoundingClientRect();
                const tooltipRect = tooltip.getBoundingClientRect();
                
                // Calculate position to avoid tooltip going off-screen
                let left = rect.left + rect.width + 10;
                let top = rect.top - tooltipRect.height / 2;
                
                // Adjust if tooltip would go off right edge
                if (left + tooltipRect.width > window.innerWidth) {
                    left = rect.left - tooltipRect.width - 10;
                }
                
                // Adjust if tooltip would go off top or bottom
                if (top < 0) {
                    top = 0;
                } else if (top + tooltipRect.height > window.innerHeight) {
                    top = window.innerHeight - tooltipRect.height;
                }
                
                tooltip.style.left = `${left}px`;
                tooltip.style.top = `${top}px`;
                tooltip.style.display = 'block';
            });
            
            point.addEventListener('mouseout', () => {
                tooltip.style.display = 'none';
            });
        });
    }
} 