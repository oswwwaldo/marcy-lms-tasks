console.log('content.js');

(async () => {
    const nav = document.querySelector('header.sticky > div:last-of-type');

    const btnWidget = createDomElement(
        `
        <button type="button" style="padding: 0 12px; height: 36px;">
            <span> Import to Google Tasks || Sync </span>
        </button>
        `
    )

    nav.append(btnWidget);
})();

function createDomElement(html) {
    const dom = new DOMParser().parseFromString(html, 'text/html');
    return dom.body.firstElementChild;
}