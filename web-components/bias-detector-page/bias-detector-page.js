import {RoutingService} from "../../services/RoutingService.js";
import {BiasAnalysisService} from "../../services/BiasAnalysisService.js";

const applicationModule = require('assistos').loadModule('application', {});

export class BiasDetectorPage {
    constructor(element, invalidate) {
        this.element = element;
        this.invalidate = invalidate;
        this.analyses = [];
        this.currentExpandedAnalysis = null;
        this.invalidate();
    }

    async beforeRender() {
        try {
            const analyses = await applicationModule.getApplicationTasks(assistOS.space.id, "BiasDetector", "GenerateAnalysis");
            this.analyses = analyses;
            this.tableRows = this.generateTableRows(analyses);
        } catch (error) {
            console.error('Error loading analyses:', error);
            this.tableRows = '<div class="no-analyses">No analyses found</div>';
        }
    }

    generateTableRows(analyses) {
        if (!analyses || analyses.length === 0) {
            return '<div class="no-analyses">No analyses found</div>';
        }

        return analyses.map(analysis => {
            const status = analysis.status === 'completed' ? 'Completed' : 'In Progress';
            const statusClass = analysis.status === 'completed' ? 'status-completed' : 'status-pending';

            return `
                <div class="analysis-item" data-id="${analysis.id}">
                    <div class="analysis-header">
                        <div class="analysis-title">Bias Analysis ${analysis.id}</div>
                        <div class="analysis-status ${statusClass}">${status}</div>
                        <div class="analysis-actions">
                            <button class="action-button" data-local-action="editAnalysis" data-analysis-id="${analysis.id}">
                                Edit
                            </button>
                            <button class="action-button" data-local-action="deleteAnalysis" data-analysis-id="${analysis.id}">
                                Delete
                            </button>
                        </div>
                    </div>
                    <div class="analysis-content" id="analysis-content-${analysis.id}"></div>
                </div>
            `;
        }).join('');
    }

    async afterRender() {
        // Add click listeners to analysis items
        const analysisItems = this.element.querySelectorAll('.analysis-item');
        analysisItems.forEach(item => {
            const header = item.querySelector('.analysis-header');
            header.addEventListener('click', (e) => {
                // Don't expand if clicking action buttons
                if (!e.target.closest('.action-button')) {
                    this.toggleAnalysis(item);
                }
            });
        });
    }

    async toggleAnalysis(analysisItem) {
        const analysisId = analysisItem.dataset.id;
        const contentDiv = analysisItem.querySelector(`#analysis-content-${analysisId}`);

        // If already expanded, collapse it
        if (this.currentExpandedAnalysis === analysisId) {
            contentDiv.innerHTML = '';
            this.currentExpandedAnalysis = null;
            return;
        }

        // Collapse any currently expanded analysis
        if (this.currentExpandedAnalysis) {
            const currentContent = this.element.querySelector(`#analysis-content-${this.currentExpandedAnalysis}`);
            if (currentContent) {
                currentContent.innerHTML = '';
            }
        }

        // Expand the clicked analysis
        this.currentExpandedAnalysis = analysisId;

        // Get the analysis data
        const analysis = this.analyses.find(a => a.id === analysisId);
        if (!analysis || analysis.status !== 'completed') return;

        // Clone and append the visualization template
        const template = this.element.querySelector('#visualization-template');
        const content = template.content.cloneNode(true);
        contentDiv.innerHTML = '';
        contentDiv.appendChild(content);

        // Update the visualization and results
        await this.updateVisualization(analysis.result, contentDiv);
        this.updateResults(analysis.result, contentDiv);
    }

    async openBiasGeneratorModal() {
        await assistOS.UI.openModal('bias-generator-modal');
    }

    async editAnalysis(_target) {
        const analysisId = _target.dataset.analysisId;
        const analysis = this.analyses.find(a => a.id === analysisId);
        if (analysis) {
            // Open modal with pre-filled data
            await assistOS.UI.openModal('bias-generator-modal', { analysisData: analysis.data });
        }
    }

    async deleteAnalysis(_target) {
        const analysisId = _target.dataset.analysisId;
        if (await assistOS.UI.showConfirmation('Delete Analysis', 'Are you sure you want to delete this analysis?')) {
            await applicationModule.deleteApplicationTask(assistOS.space.id, "BiasDetector", analysisId);
            await this.invalidate();
        }
    }

    // Helper function to format bias names
    formatBiasName(biasName) {
        return biasName
            .replace(/_/g, ' ')
            .split(' ')
            .map(word => word.charAt(0).toUpperCase() + word.slice(1))
            .join(' ');
    }

    updateVisualization(biasResults, container) {
        if (!biasResults || !biasResults.biases || !biasResults.scores) {
            console.error('Invalid bias results for visualization');
            return;
        }

        const svg = container.querySelector('svg');
        if (!svg) {
            console.error('SVG element not found');
            return;
        }

        const width = parseInt(svg.getAttribute('width'));
        const height = parseInt(svg.getAttribute('height'));
        const leftPadding = width * 0.15;
        const rightPadding = width * 0.1;
        const bottomPadding = 70;
        const graphHeight = height - bottomPadding;
        const graphWidth = width - (leftPadding + rightPadding);
        const radius = Math.min(graphWidth / 2, height - bottomPadding) * 0.8;

        // Get SVG groups
        const quadrants = svg.querySelector('#quadrants');
        const axes = svg.querySelector('#axes');
        const points = svg.querySelector('#points');
        const labels = svg.querySelector('#labels');

        if (!quadrants || !axes || !points || !labels) {
            console.error('Required SVG groups not found');
            return;
        }

        // Draw grid lines
        const gridLines = [];
        for (let i = -10; i <= 10; i += 2) {
            const x = leftPadding + ((i + 10) * radius / 10);
            const y = graphHeight - ((i + 10) * radius / 10);

            gridLines.push(`
                <line class="scale-line" x1="${x}" y1="${graphHeight - 2 * radius}" x2="${x}" y2="${graphHeight}" />
                <line class="scale-line" x1="${leftPadding}" y1="${y}" x2="${leftPadding + 2 * radius}" y2="${y}" />
            `);
        }

        // Add zero reference lines
        const zeroX = leftPadding + (10 * radius / 10);
        const zeroY = graphHeight - (10 * radius / 10);
        gridLines.push(`
            <line class="zero-line" x1="${zeroX}" y1="${graphHeight - 2 * radius}" x2="${zeroX}" y2="${graphHeight}" 
                  style="stroke: #ccc; stroke-width: 1; stroke-opacity: 0.5;" />
            <line class="zero-line" x1="${leftPadding}" y1="${zeroY}" x2="${leftPadding + 2 * radius}" y2="${zeroY}"
                  style="stroke: #ccc; stroke-width: 1; stroke-opacity: 0.5;" />
        `);

        quadrants.innerHTML = gridLines.join('');

        // Draw axes and labels
        axes.innerHTML = this.generateAxesHTML(leftPadding, graphHeight, radius);

        // Draw points and labels
        points.innerHTML = '';
        labels.innerHTML = '';
        biasResults.biases.forEach((bias, index) => {
            const score = biasResults.scores[index];
            const x = leftPadding + ((score + 10) * radius / 10);
            const y = graphHeight - ((score + 10) * radius / 10);

            points.innerHTML += `<circle class="bias-point" cx="${x}" cy="${y}" r="5" fill="#007bff" stroke="#0056b3"/>`;
            labels.innerHTML += `
                <text class="bias-label" x="${x}" y="${y - 15}" 
                      text-anchor="middle" dominant-baseline="auto">
                    ${score.toFixed(1)}
                </text>
            `;
        });
    }

    generateAxesHTML(leftPadding, graphHeight, radius) {
        return `
            <line class="axis-line" x1="${leftPadding}" y1="${graphHeight}" x2="${leftPadding + 2 * radius}" y2="${graphHeight}" />
            <line class="axis-line" x1="${leftPadding}" y1="${graphHeight}" x2="${leftPadding}" y2="${graphHeight - 2 * radius}" />
            
            <text x="${leftPadding + 2 * radius + 20}" y="${graphHeight + 20}" class="axis-label">Bias Strength</text>
            <text x="${leftPadding - 40}" y="${graphHeight - 2 * radius - 10}" class="axis-label">Bias Impact</text>
            
            ${Array.from({length: 11}, (_, i) => {
                const value = i * 2 - 10;
                const x = leftPadding + ((value + 10) * radius / 10);
                const yPos = graphHeight - ((value + 10) * radius / 10);
                return `
                    <text x="${x}" y="${graphHeight + 20}" class="scale-text">${value}</text>
                    <text x="${leftPadding - 25}" y="${yPos}" class="scale-text">${value}</text>
                `;
            }).join('')}
        `;
    }

    updateResults(biasResults, container) {
        if (!biasResults || !biasResults.biases) {
            console.error('Invalid bias results for display');
            return;
        }

        const resultsContainer = container.querySelector('.bias-results');
        if (!resultsContainer) {
            console.error('Results container not found');
            return;
        }

        const resultsHtml = biasResults.biases.map((bias, index) => {
            const score = biasResults.scores[index];
            const explanation = biasResults.explanations[index];
            const formattedBiasName = this.formatBiasName(bias);

            return `
                <div class="bias-item">
                    <div class="bias-name">${formattedBiasName}</div>
                    <div class="bias-score">Score: ${score.toFixed(2)}</div>
                    <div class="bias-explanation">${explanation}</div>
                </div>
            `;
        }).join('');

        resultsContainer.innerHTML = resultsHtml;
    }
} 