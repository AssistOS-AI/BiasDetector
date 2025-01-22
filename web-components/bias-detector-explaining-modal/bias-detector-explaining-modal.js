const applicationModule = require('assistos').loadModule('application', {});
const personalityModule = require('assistos').loadModule('personality', {});

export class BiasDetectorExplainingModal {
    constructor(element, invalidate) {
        this.element = element;
        this.invalidate = invalidate;
        this.personalities = [];
        this.personalityOptions = [];
        this.documentId = this.element.getAttribute("data-documentId");
        this.invalidate();
    }

    async beforeRender() {
        try {
            // Load personalities from AssistOS
            const personalities = await personalityModule.getPersonalitiesMetadata(assistOS.space.id);
            this.personalities = personalities;
            this.personalityOptions = personalities.map(personality => {
                return `<option value="${personality.id}">${personality.name}</option>`;
            });
        } catch (error) {
            console.error('Error loading personalities:', error);
            this.personalityOptions = [];
        }
    }

    async afterRender() {
        this.setupEventListeners();
    }

    async closeModal(_target, taskId) {
        await assistOS.UI.closeModal(_target, taskId);
    }

    setupEventListeners() {
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
                console.log('Form data:', formData);

                if (!formData.isValid) {
                    return assistOS.UI.showApplicationError("Invalid form data", "Please select a personality", "error");
                }

                const { personality } = formData.data;
                if (!this.documentId) {
                    return assistOS.UI.showApplicationError("Missing Document", "No document selected for analysis", "error");
                }

                const taskData = {
                    personality,
                    sourceDocumentId: this.documentId
                };

                console.log('Running application task with data:', taskData);
                const taskId = await applicationModule.runApplicationTask(
                    assistOS.space.id,
                    "BiasDetector",
                    "ExplainedAnalysis",
                    taskData
                );

                await assistOS.UI.closeModal(this.element, taskId);
            });
        } catch (error) {
            console.error('Error in handleExplanation:', error);
            assistOS.UI.showApplicationError("Error", error.message || "Failed to generate explanation", "error");
        }
    }

    setDocumentId(documentId) {
        console.log('setDocumentId called with:', documentId);
        this.documentId = documentId;
    }
} 