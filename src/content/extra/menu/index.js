(function () {
  const pluginId = "adobedocs-chrome-extension-menu";
  /*
    const plugin =
    document
      .querySelector("[data-adobedocs-plugin-root]")
      .getAttribute("data-adobedocs-plugin-root") + "menu";
    */

  const plugin =
    "https://dxenablementbeta.blob.core.windows.net/adobedocs-chrome-extension/menu";

  function setLocalStorage() {
    let c = {
      product: getContext().product?.value,
      version: getContext().version?.value,
      subProduct: getContext().subProduct?.value,
    };

    let data = {
      current: c.product,
    };

    data[c.product] = {
      version: c.version,
      subProduct: c.subProduct,
    };

    let context = {
      ...JSON.parse(localStorage.getItem(pluginId)),
      ...data,
    };

    localStorage.setItem(pluginId, JSON.stringify(context));
  }

  function loadContext() {
    let derivedContext = false;

    const path = window.location.pathname;

    let context = {
      product: null,
      version: null,
      subProduct: null,
    };

    if (path.includes("experience-manager")) {
      derivedContext = true;
      // Defaults
      context.product = "experience-manager";
      context.version = "cloud-service";
      context.subProduct = "foundation";

      if (path.includes("experience-manager-65")) {
        context.version = "6-5";
      }

      if (
        ["/sites/", "/universal-editor/"].some((subPath) =>
          path.includes(subPath)
        )
      ) {
        context.subProduct = "sites";
      } else if (
        [
          "/assets/",
          "/dynamic-media/",
          "/experience-manager-assets-essentials/",
          "/experience-manager-desktop-app/",
          "/experience-manager-brand-portal/",
        ].some((subPath) => path.includes(subPath))
      ) {
        context.subProduct = "assets";
      } else if (
        ["/forms/", "/getting-started-with-aem-headless/"].some((subPath) =>
          path.includes(subPath)
        )
      ) {
        context.subProduct = "forms";
      } else if (
        ["/headless/", "/getting-started-with-aem-headless/"].some((subPath) =>
          path.includes(subPath)
        )
      ) {
        context.subProduct = "headless";
      }
    } else if (path.includes("analytics")) {
      derivedContext = true;

      // Defaults
      context.product = "analytics";
    }

    if (!derivedContext) {
      // Get from local storage
      const obj = JSON.parse(localStorage.getItem(pluginId)) || {};

      if (obj?.current) {
        context.product = obj.current;
      }

      context = { ...context, ...obj[context.product] } || {};
    }

    if (context.product) {
      document.querySelector('select[data-js-acde-context="products"]').value =
        context.product;
      // Remove select an app option
      document
        .querySelectorAll('select[data-js-acde-context="products"] option')
        .forEach((el) => {
          if (!el.value) {
            el.remove();
          }
        });
    }

    if (context.version) {
      document.querySelector('select[data-js-acde-context="versions"]').value =
        context.version;
    }

    if (context.subProduct) {
      document.querySelector(
        'select[data-js-acde-context="subProducts"]'
      ).value = context.subProduct;
    }
  }

  function getContext() {
    return {
      product: document.querySelector(
        'select[data-js-acde-context="products"]'
      ),
      version: document.querySelector(
        'select[data-js-acde-context="versions"]'
      ),
      subProduct: document.querySelector(
        'select[data-js-acde-context="subProducts"]'
      ),
    };
  }

  function showContext(aspect, html) {
    const el = document.querySelector(`[data-js-acde-context="${aspect}"]`);
    if (el) {
      el.innerHTML = html;
      el.style.display = "inline";
    }
  }

  function hideContext(aspect) {
    const el = document.querySelector(`[data-js-acde-context="${aspect}"]`);
    if (el) {
      el.innerHTML = "";
      el.style.display = "none";
    }
  }

  loadContext();

  (async () => {
    let response;

    try {
      response = await fetch(
        `${plugin}/${getContext().product?.value}/versions.html`
      );

      if (response.ok) {
        showContext("versions", await response.text());

        response = await fetch(
          `${plugin}/${getContext().product?.value}/${
            getContext().version?.value
          }/sub-products.html`
        );

        response.ok
          ? showContext("subProducts", await response.text())
          : hideContext("subProducts");

        getContext().version.addEventListener("change", async () => {
          response = await fetch(
            `${plugin}/${getContext().product?.value}/${
              getContext().version?.value
            }/sub-products.html`
          );

          response.ok
            ? showContext("subProducts", await response.text())
            : hideContext("subProducts");
        });
      } else {
        hideContext("versions");
        hideContext("subProducts");
      }
    } catch (error) {
      console.error("Error fetching context", error);
    }

    loadContext();

    async function getMenu(contentType) {
      let path = `${getContext().product?.value}`;

      if (getContext().version?.value) {
        path += "/" + getContext().version?.value;
      }

      if (getContext().subProduct?.value) {
        path += "/" + getContext().subProduct?.value;
      }

      if (contentType) {
        path += "/" + contentType;
      }

      path += ".html";

      const response = await fetch(`${plugin}/${path}`);
      document.querySelector(`[data-js-acde-menu]`).innerHTML = response.ok
        ? await response.text()
        : `<h3 class="title">Menu not yet defined :(</h3>
          <div class="content">
            The product menu feature is in beta, and not defined at this time.
            If you would like to contribute a menu, please contact dgonzale@adobe.com on Slack.
          </div>
        `;
    }

    document
      .querySelectorAll(`[data-js-acde-content-types] li`)
      .forEach((contentType) => {
        contentType.addEventListener("mouseenter", async () => {
          await getMenu(contentType.innerText.toLowerCase().replace(" ", "-"));
          document.querySelector(`[data-js-acde-menu]`).style.display = "block";

          document
            .querySelectorAll(`[data-js-acde-content-types] li`)
            .forEach((contentType) => {
              contentType.classList.remove("active");
            });
          contentType.classList.add("active");
        });
      });

    document
      .querySelector(`[data-js-acde]`)
      .addEventListener("mouseleave", () => {
        document.querySelector(`[data-js-acde-menu]`).style.display = "none";
        document
          .querySelectorAll(`[data-js-acde-content-types] li`)
          .forEach((contentType) => {
            contentType.classList.remove("active");
          });
      });

    getContext().product.addEventListener("change", (event) => {
      setLocalStorage();
      const url = event.target
        .querySelector(`option[value="${event.target.value}"]`)
        ?.getAttribute("data-js-acde-url");
      if (url) {
        window.location = url;
      }
    });

    getContext().version.addEventListener("change", (event) => {
      setLocalStorage();
      const url = event.target
        .querySelector(`option[value="${event.target.value}"]`)
        ?.getAttribute("data-js-acde-url");
      if (url) {
        window.location = url;
      }
    });

    getContext().subProduct.addEventListener("change", (event) => {
      setLocalStorage();

      const url = event.target
        .querySelector(`option[value="${event.target.value}"]`)
        ?.getAttribute("data-js-acde-url");
      if (url) {
        window.location = url;
      }
    });
  })();
})();
