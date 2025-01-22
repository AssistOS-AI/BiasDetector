const applicationModule = require('assistos').loadModule('application', {});
const personalityModule = require('assistos').loadModule('personality', {});

export class BiasDetectorExplainingModal {
    constructor(element, invalidate) {
        this.element = element;
        this.invalidate = invalidate;
        this.documentId = null;
        this.personalities = [];
    }

    async beforeRender() {
        // Get available personalities
        const personalities = await personalityModule.getPersonalities(assistOS.space.id);
        this.personalities = personalities;

        // Generate personality options
        this.personalityOptions = personalities.map(p => 
            `<option value="${p.id}">${p.name}</option>`
        ).join('');
    }

    async afterRender() {
        // Add form submit handler
        const form = this.element.querySelector('#explainForm');
        if (form) {
            form.addEventListener('submit', async (e) => {
                e.preventDefault();
                await this.handleExplanation(form);
            });
        }
    }

    async handleExplanation(form) {
        try {
            await assistOS.loadifyFunction(async () => {
                const formData = await assistOS.UI.extractFormInformation(form);

                if (!formData.isValid) {
                    return assistOS.UI.showApplicationError("Invalid form data", "Please select a personality", "error");
                }

                const { personality } = formData.data;

                // Run the ExplainedAnalysis task
                const taskId = await applicationModule.runApplicationTask(
                    assistOS.space.id,
                    "BiasDetector",
                    "ExplainedAnalysis",
                    {
                        personality,
                        sourceDocumentId: this.documentId
                    }
                );

                await assistOS.UI.closeModal(this.element, taskId);
            });
        } catch (error) {
            console.error('Error in handleExplanation:', error);
            assistOS.UI.showApplicationError("Explanation Error", error.message, "error");
        }
    }

    setDocumentId(documentId) {
        this.documentId = documentId;
    }
} 