import {RoutingService} from "../../services/RoutingService.js";

const personalityModule = require('assistos').loadModule('personality', {});
const documentModule = require('assistos').loadModule('document', {});

export class BiasDetectorLanding {
    constructor(element, invalidate) {
        this.element = element;
        this.invalidate = invalidate;
        this.documents = [];
        this.refreshDocuments = async () => {
            this.documents = await assistOS.space.getDocumentsMetadata(assistOS.space.id);
            // Filter only bias analysis documents
            this.documents = this.documents.filter((doc) => {
                return doc.title.startsWith("bias_analysis_");
            }) || [];
        };
        this.invalidate(async () => {
            await this.refreshDocuments();
            this.boundsOnListUpdate = this.onListUpdate.bind(this);
        });
    }

    onListUpdate() {
        this.invalidate(this.refreshDocuments);
    }

    async beforeRender() {
        this.tableRows = "";
        this.documents.forEach((doc) => {
            console.log('Document:', doc.title);
            console.log('Full document object:', doc);
            console.log('Metadata:', doc.metadata);

            const metadata = doc.metadata || {};
            const timestamp = metadata.timestamp ? new Date(metadata.timestamp).toLocaleString() : 'N/A';
            const personality = metadata.personality || 'N/A';

            this.tableRows += `
                <div class="analysis-card" data-id="${doc.id}">
                    <div class="analysis-content" data-local-action="viewAnalysis">
                        <h3>${doc.title}</h3>
                        <div class="analysis-meta">
                            <span class="personality">${personality}</span>
                            <span class="timestamp">${timestamp}</span>
                        </div>
                    </div>
                    <div class="analysis-actions">
                        <button class="action-btn edit-btn" data-local-action="editAction" data-id="${doc.id}">
                            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                                <path d="M16.474 5.408l2.118 2.117m-.756-3.982L12.109 9.27a2.118 2.118 0 00-.58 1.082L11 13l2.648-.53c.41-.082.786-.283 1.082-.579l5.727-5.727a1.853 1.853 0 000-2.621 1.853 1.853 0 00-2.621 0z" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
                                <path d="M19 15v3a2 2 0 01-2 2H6a2 2 0 01-2-2V7a2 2 0 012-2h3" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
                            </svg>
                        </button>
                        <button class="action-btn delete-btn" data-local-action="deleteAction" data-id="${doc.id}">
                            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                                <path d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
                            </svg>
                        </button>
                    </div>
                </div>`;
        });

        if (assistOS.space.loadingDocuments) {
            assistOS.space.loadingDocuments.forEach((taskId) => {
                this.tableRows += `
                    <div data-id="${taskId}" class="analysis-card placeholder-analysis">
                        <div class="loading-icon small"></div>
                    </div>`;
            });
        }

        if (this.tableRows === "") {
            this.tableRows = `<div class="no-analyses">No analyses found</div>`;
        }
    }

    async afterRender() {
        // Setup any event listeners or post-render operations
        const analysisItems = this.element.querySelectorAll('.analysis-card');
        analysisItems.forEach(item => {
            const content = item.querySelector('.analysis-content');
            if (content) {
                content.addEventListener('click', async () => {
                    const docId = item.getAttribute('data-id');
                    await this.viewAnalysis(docId);
                });
            }
        });
    }

    async editAction(_target) {
        let documentId = this.getDocumentId(_target);
        await assistOS.UI.changeToDynamicPage("space-application-page", `${assistOS.space.id}/Space/document-view-page/${documentId}`);
    }

    async deleteAction(_target) {
        let message = "Are you sure you want to delete this analysis?";
        let confirmation = await assistOS.UI.showModal("confirm-action-modal", {message}, true);
        if (!confirmation) {
            return;
        }
        await documentModule.deleteDocument(assistOS.space.id, this.getDocumentId(_target));
        this.invalidate(this.refreshDocuments);
    }

    getDocumentId(_target) {
        return _target.getAttribute('data-id');
    }

    async viewAnalysis(docId) {
        await assistOS.UI.changeToDynamicPage("space-application-page", `${assistOS.space.id}/BiasDetector/bias-detector-page/${docId}`);
    }

    async openBiasDetectorModal() {
        const taskId = await assistOS.UI.showModal("bias-detector-modal", {
            "presenter": "bias-detector-modal"
        }, true);
        if (taskId) {
            assistOS.watchTask(taskId);
        }
    }
} 