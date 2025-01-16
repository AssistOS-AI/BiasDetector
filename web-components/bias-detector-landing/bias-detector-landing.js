import {RoutingService} from "../../services/RoutingService.js";

const personalityModule = require('assistos').loadModule('personality', {});
const documentModule = require('assistos').loadModule('document', {});

export class BiasDetectorLanding {
    constructor(element, invalidate) {
        this.notificationId = "biases";
        this.refreshAnalyses = async () => {
            this.analyses = await assistOS.space.getDocumentsMetadata(assistOS.space.id);
            // Filter only bias analysis documents
            this.analyses = this.analyses.filter((document) => {
                return document.title.startsWith("bias_analysis_");
            }) || [];
            // Clean up titles for display
            this.analyses.forEach((analysis) => {
                analysis.title = analysis.title.replace("bias_analysis_", "");
            });
        };
        this.element = element;
        this.invalidate = invalidate;
        this.id = "biases";
        this.invalidate(async () => {
            await this.refreshAnalyses();
            this.boundOnListUpdate = this.onListUpdate.bind(this);
        });
    }

    onListUpdate() {
        this.invalidate(this.refreshAnalyses);
    }

    async beforeRender() {
        let analysesContent = "";
        if (this.analyses && this.analyses.length > 0) {
            this.analyses.forEach((analysis) => {
                analysesContent += `
                    <div class="analysis-card" data-id="${analysis.id}">
                        <h3>${analysis.title}</h3>
                        <div class="analysis-actions">
                            <button class="view-btn" data-action="viewAnalysis">View Analysis</button>
                        </div>
                    </div>`;
            });
        }

        // Add loading placeholders if there are pending tasks
        if (assistOS.space.loadingDocuments) {
            assistOS.space.loadingDocuments.forEach((taskId) => {
                analysesContent += `
                    <div data-id="${taskId}" class="analysis-card placeholder-analysis">
                        <div class="loading-icon small"></div>
                    </div>`;
            });
        }

        // Show message if no analyses
        if (!analysesContent) {
            analysesContent = '<div class="no-analyses">No analyses available yet</div>';
        }

        const analysesList = this.element.querySelector('#analysesList');
        if (analysesList) {
            analysesList.innerHTML = analysesContent;
        }
    }

    async afterRender() {
        this.setupEventListeners();
    }

    setupEventListeners() {
        const newAnalysisBtn = this.element.querySelector('#newAnalysisBtn');
        if (newAnalysisBtn) {
            newAnalysisBtn.addEventListener('click', () => this.openNewAnalysisModal());
        }

        // Add click listeners for analysis cards
        const analysisCards = this.element.querySelectorAll('.analysis-card');
        analysisCards.forEach(card => {
            const viewBtn = card.querySelector('[data-action="viewAnalysis"]');
            if (viewBtn) {
                viewBtn.addEventListener('click', (e) => {
                    e.stopPropagation();
                    this.viewAnalysis(card.getAttribute('data-id'));
                });
            }
        });
    }

    async openNewAnalysisModal() {
        const taskId = await assistOS.UI.showModal("bias-generator-modal", {
            "presenter": "bias-generator-modal"
        }, true);

        if (taskId) {
            assistOS.watchTask(taskId);
        }
    }

    async viewAnalysis(analysisId) {
        await assistOS.UI.changeToDynamicPage(
            "bias-detector-page",
            `${assistOS.space.id}/BiasDetector/bias-detector-page/${analysisId}`
        );
    }
} 