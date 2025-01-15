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
                const title = doc.title || doc.name || doc.id;
                return `<option value="${doc.id}">${title}</option>`;
            });
        } catch (error) {
            console.error('Error loading data:', error);
            this.personalityOptions = [];
            this.documentOptions = [];
        }
    }

    async afterRender() {
        this.setupEventListeners();
        this.setupSourceToggle();
    }

    setupSourceToggle() {
        const sourceOptions = this.element.querySelectorAll('.source-option');
        const sourceContents = this.element.querySelectorAll('.source-content');
        const textInput = this.element.querySelector('textarea[name="text"]');
        const documentSelect = this.element.querySelector('select[name="document"]');

        sourceOptions.forEach(option => {
            option.addEventListener('click', () => {
                // Update active states
                sourceOptions.forEach(opt => opt.classList.remove('active'));
                option.classList.add('active');

                // Show corresponding content
                sourceContents.forEach(content => content.style.display = 'none');
                const isEnterText = option.textContent.includes('Enter Text');
                sourceContents[isEnterText ? 0 : 1].style.display = 'block';

                // Update required attributes
                textInput.required = isEnterText;
                documentSelect.required = !isEnterText;

                if (!isEnterText) {
                    const selectedDocument = documentSelect.value;
                    const selectedTitle = documentSelect.options[documentSelect.selectedIndex]?.text;
                    console.log('Document selection activated:', { id: selectedDocument, title: selectedTitle });
                }
            });
        });

        // Add change listener to document select
        documentSelect.addEventListener('change', async (e) => {
            const documentId = e.target.value;
            const documentTitle = e.target.options[e.target.selectedIndex]?.text;
            console.log('Selected document:', { id: documentId, title: documentTitle });

            try {
                const document = await documentModule.getDocument(assistOS.space.id, documentId);
                console.log('Document retrieved:', document);
            } catch (error) {
                console.error('Error loading document:', error);
            }
        });
    }

    setupEventListeners() {
        const form = this.element.querySelector('#biasForm');
        form.addEventListener('submit', async (e) => {
            e.preventDefault();
            await this.handleAnalysis(form);
        });
    }

    async extractDocumentContent(document) {
        if (!document) return '';

        if (document.content) {
            return document.content;
        }

        if (document.chapters) {
            return document.chapters.map(chapter => {
                const chapterTexts = [];

                if (chapter.title) {
                    chapterTexts.push(`Chapter: ${chapter.title}`);
                }

                if (chapter.paragraphs && chapter.paragraphs.length > 0) {
                    const paragraphsText = chapter.paragraphs
                        .filter(p => p && p.text)
                        .map(p => p.text)
                        .join('\n\n');

                    if (paragraphsText) {
                        chapterTexts.push(paragraphsText);
                    }
                }

                return chapterTexts.filter(text => text && text.trim()).join('\n\n');
            }).filter(text => text && text.trim()).join('\n\n');
        }

        return '';
    }

    async handleAnalysis(form) {
        try {
            const formData = await assistOS.UI.extractFormInformation(form);
            if (!formData.isValid) {
                return;
            }

            const { personality, prompt, topBiases } = formData.data;
            let text;

            // Get text based on active source
            const textSource = this.element.querySelector('.source-option.active');
            if (textSource.textContent.includes('Enter Text')) {
                text = formData.data.text;
            } else {
                const documentId = formData.data.document;
                const document = await documentModule.getDocument(assistOS.space.id, documentId);
                text = await this.extractDocumentContent(document);

                if (!text) {
                    throw new Error('Could not extract text from document');
                }
            }

            // Get personality name
            const personalitySelect = this.element.querySelector('select[name="personality"]');
            const selectedOption = personalitySelect.options[personalitySelect.selectedIndex];
            const personalityName = selectedOption ? selectedOption.textContent : personality;

            await RoutingService.navigateInternal('bias-detector-page', {
                personality: personalityName,
                prompt,
                text,
                'top-biases': topBiases
            });
        } catch (error) {
            console.error('Error during analysis:', error);
        }
    }
} 