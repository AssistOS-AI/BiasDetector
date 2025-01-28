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
            this.personalityOptions = personalities.map(personality =>
                `<label class="checkbox-item">
                    <input type="checkbox" name="personalities" value="${personality.id}">
                    ${personality.name}
                </label>`
            ).join('');
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
        const submitButton = this.element.querySelector('#explainButton');
        submitButton.disabled = true;
        submitButton.style.opacity = '0.6';
        submitButton.style.cursor = 'not-allowed';

        if (form) {
            form.addEventListener('submit', async (e) => {
                e.preventDefault();
                await this.handleExplanation(form);
            });

            const checkboxList = this.element.querySelector('#personalityCheckboxes');
            checkboxList.addEventListener('change', () => {
                const checkedBoxes = checkboxList.querySelectorAll('input[type="checkbox"]:checked');
                const isDisabled = checkedBoxes.length === 0;
                submitButton.disabled = isDisabled;
                submitButton.style.opacity = isDisabled ? '0.6' : '1';
                submitButton.style.cursor = isDisabled ? 'not-allowed' : 'pointer';
            });
        }
    }

    async handleExplanation(form) {
        try {
            await assistOS.loadifyFunction(async () => {
                const formData = await assistOS.UI.extractFormInformation(form);
                console.log('Form data:', formData);

                // Get all checked checkboxes directly
                const checkedBoxes = form.querySelectorAll('input[name="personalities"]:checked');
                const selectedPersonalities = Array.from(checkedBoxes).map(cb => cb.value);
                
                console.log('Selected personalities (raw):', selectedPersonalities);
                if (!selectedPersonalities.length) {
                    return assistOS.UI.showApplicationError("Invalid form data", "Please select at least one personality", "error");
                }

                const taskData = {
                    personalities: selectedPersonalities,
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