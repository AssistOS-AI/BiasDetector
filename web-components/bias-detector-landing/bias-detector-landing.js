import {RoutingService} from "../../services/RoutingService.js";

const personalityModule = require('assistos').loadModule('personality', {});
const documentModule = require('assistos').loadModule('document', {});

export class BiasDetectorLanding {
    constructor(element, invalidate) {
        this.element = element;
        this.invalidate = invalidate;
        this.documents = [];
        this.invalidate();
    }

    async beforeRender() {
        try {
            // Load personalities from AssistOS
            const personalities = await personalityModule.getPersonalitiesMetadata(assistOS.space.id);
            console.log('Number of personalities:', personalities.length);
            this.personalities = personalities;
            this.personalityOptions = personalities.map(personality => {
                return `<option value="${personality.id}">${personality.name}</option>`;
            });

            // Load documents from AssistOS
            const documents = await documentModule.getDocumentsMetadata(assistOS.space.id);
            console.log('Number of documents:', documents.length);
            console.log('Documents:', documents);
            this.documents = documents;
            this.documentOptions = documents.map(doc => {
                return `<option value="${doc.id}">${doc.title}</option>`;
            });
        } catch (error) {
            console.error('Error loading data:', error);
            this.personalityOptions = [];
        }
    }

    async afterRender() {
        this.setupEventListeners();
        this.setupSourceToggle();
    }

    setupSourceToggle() {
        const sourceOptions = this.element.querySelectorAll('.source-option');
        const sourceContents = this.element.querySelectorAll('.source-content');
        const textInput = this.element.querySelector('#text');
        const documentSelect = this.element.querySelector('#document');

        sourceOptions.forEach(option => {
            option.addEventListener('click', () => {
                // Update active states
                sourceOptions.forEach(opt => opt.classList.remove('active'));
                sourceContents.forEach(content => content.classList.remove('active'));
                option.classList.add('active');

                // Show corresponding content
                const sourceType = option.getAttribute('data-source');
                const content = this.element.querySelector(`#${sourceType}Input`);
                content.classList.add('active');

                // Update required attributes
                if (sourceType === 'text') {
                    textInput.setAttribute('required', '');
                    documentSelect.removeAttribute('required');
                } else {
                    documentSelect.setAttribute('required', '');
                    textInput.removeAttribute('required');
                }
            });
        });
    }

    setupEventListeners() {
        const analyzeBtn = this.element.querySelector('#analyzeButton');
        analyzeBtn.addEventListener('click', () => this.handleAnalysis());
    }

    async handleAnalysis() {
        const personality = this.element.querySelector('#personality').value;
        const prompt = this.element.querySelector('#prompt').value;
        const topBiases = parseInt(this.element.querySelector('#topBiases').value);

        // Get text based on active source
        const activeSource = this.element.querySelector('.source-option.active').getAttribute('data-source');
        let text;

        if (activeSource === 'text') {
            text = this.element.querySelector('#text').value;
        } else {
            const documentId = this.element.querySelector('#document').value;
            if (!documentId) {
                alert('Please select a document');
                return;
            }
            try {
                const document = await documentModule.getDocument(assistOS.space.id, documentId);
                text = document.content;
            } catch (error) {
                console.error('Error fetching document:', error);
                alert('Error loading document content. Please try again.');
                return;
            }
        }

        if (!personality || !text) {
            alert('Please fill in all required fields');
            return;
        }

        try {
            // Navigate to analysis page with parameters
            RoutingService.navigateInternal('bias-detector-page', {
                personality,
                prompt,
                text,
                topBiases
            });
        } catch (error) {
            console.error('Error during analysis:', error);
            alert('An error occurred during analysis. Please try again.');
        }
    }
} 