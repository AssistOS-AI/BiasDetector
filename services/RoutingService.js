const BIASDETECTORLANDING_PAGE = "bias-detector-landing";

export class RoutingService {
    constructor() {
        if (RoutingService.instance) {
            return RoutingService.instance;
        } else {
            RoutingService.instance = this;
            return this;
        }
    }

    async navigateToLocation(locationArray = [], appName) {
        if (locationArray.length === 0 || locationArray[0] === BIASDETECTORLANDING_PAGE) {
            const pageUrl = `${assistOS.space.id}/${appName}/${BIASDETECTORLANDING_PAGE}`;
            await assistOS.UI.changeToDynamicPage(BIASDETECTORLANDING_PAGE, pageUrl);
            return;
        }
        if (locationArray[locationArray.length - 1] !== BIASDETECTORLANDING_PAGE) {
            console.error(`Invalid URL: URL must end with ${BIASDETECTORLANDING_PAGE}`);
            return;
        }
        const webComponentName = locationArray[locationArray.length - 1];
        const pageUrl = `${assistOS.space.id}/${appName}/${locationArray.join("/")}`;
        await assistOS.UI.changeToDynamicPage(webComponentName, pageUrl);
    }

    static navigateInternal(subpageName, presenterParams) {
        const composePresenterParams = (presenterParams) => {
            let presenterParamsString = "";
            Object.keys(presenterParams).forEach((key) => {
                presenterParamsString += ` data-${key}='${presenterParams[key]}'`;
            });
            return presenterParamsString;
        }
        const appContainer = document.querySelector("#bias-detector-app-container")
        appContainer.innerHTML = `<${subpageName} data-presenter="${subpageName}" ${composePresenterParams(presenterParams)}></${subpageName}>`;
    }
} 