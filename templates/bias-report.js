export class BiasReport {
    constructor() {
        this.sections = {
            visualization: null,
            biasesList: [],
            explanations: []
        };
    }

    setVisualization(svgContent) {
        this.sections.visualization = svgContent;
    }

    addBias(bias) {
        this.sections.biasesList.push(bias);
    }

    addExplanation(biasName, explanation) {
        this.sections.explanations.push({
            bias: biasName,
            explanation: explanation
        });
    }

    generateReport() {
        return {
            title: 'Bias Analysis Report',
            timestamp: new Date().toISOString(),
            content: {
                chapter1: {
                    title: 'Bias Visualization',
                    content: this.sections.visualization
                },
                chapter2: {
                    title: 'Detected Biases',
                    content: this.formatBiasesList()
                },
                chapter3: {
                    title: 'Detailed Analysis',
                    content: this.formatExplanations()
                }
            }
        };
    }

    formatBiasesList() {
        return this.sections.biasesList.map(bias => ({
            name: bias.name,
            score: bias.score,
            counterBias: bias.counterBias
        }));
    }

    formatExplanations() {
        return this.sections.explanations.map(exp => ({
            bias: exp.bias,
            explanation: exp.explanation
        }));
    }
} 