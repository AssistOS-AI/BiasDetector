import {RoutingService} from "./services/RoutingService.js";
import {BiasAnalysisService} from './services/BiasAnalysisService.js';
import {VisualizationService} from './services/VisualizationService.js';

export class Manager {
    constructor() {
        this.appName = "BiasDetector";
        this.services = new Map();
        this.services.set('RoutingService', new RoutingService());
        // this.services.set('BiasAnalysisService', new BiasAnalysisService());
        // this.services.set('VisualizationService', new VisualizationService());
    }

    async initialize() {
        // Initialize all services
        for (const service of this.services.values()) {
            await service.initialize();
        }
        console.log('BiasDetector initialized successfully');
    }

    async navigateToLocation(location) {
        this.services.get('RoutingService').navigateToLocation(location, this.appName);
    }
} 