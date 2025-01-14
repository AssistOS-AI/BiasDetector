const personalityModule = require('assistos').loadModule('personality', {});

export class BiasDetectorLanding {
    constructor(element, invalidate) {
        this.element = element;
        this.invalidate = invalidate;
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
        // this.setupEventListeners();
    }

    // setupEventListeners() {
    //     const analyzeBtn = this.element.querySelector('#analyzeBtn');
    //     analyzeBtn.addEventListener('click', () => this.handleAnalysis());
    // }
    //
    // async handleAnalysis() {
    //     const personality = this.element.querySelector('#personality').value;
    //     const prompt = this.element.querySelector('#prompt').value;
    //     const text = this.element.querySelector('#text').value;
    //     const topBiases = parseInt(this.element.querySelector('#topBiases').value);
    //
    //     if (!personality || !text) {
    //         alert('Please select a personality and enter text to analyze');
    //         return;
    //     }
    //
    //     try {
    //         // Navigate to analysis page with parameters
    //         RoutingService.navigateInternal('bias-detector-page', {
    //             personality,
    //             prompt,
    //             text,
    //             topBiases
    //         });
    //     } catch (error) {
    //         console.error('Error during analysis:', error);
    //         alert('An error occurred during analysis. Please try again.');
    //     }
    // }
} 