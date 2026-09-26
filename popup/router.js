export class Router {

    constructor(containerElement) {
        this.container = containerElement;
        this.routes = new Map();
        this.currentView = null;
    }

    register(routeName, templateId, controllerSetupFn = null) {
        this.routes.set(routeName, { templateId, setup: controllerSetupFn });
    }

    navigate(routeName, params = {}) {
        const route = this.routes.get(routeName);
        if (!route) return;

        const template = document.getElementById(route.templateId);
        if (!template) return;

        this.container.replaceChildren();

        const content = template.contentEditable.cloneNode(true);

        this.container.appendChild(content);
        this.currentView = routeName;

        if (route.setup) {
            route.setup(this.container, params);
        }
    }
}