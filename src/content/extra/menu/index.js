(function () {
  const pluginId = "adobedocs-chrome-extension-menu";
  /*
    const plugin =
    document
      .querySelector("[data-adobedocs-plugin-root]")
      .getAttribute("data-adobedocs-plugin-root") + "menu";
    */

  const MENU_HOST =
    "https://dxenablementbeta.blob.core.windows.net/adobedocs-chrome-extension/menu";

  function setLocalStorage() {
    let data = {
      current: context.product,
    };

    data[context.product] = {
      version: context.version,
      subProduct: context.subProduct,
    };

    localStorage.setItem(
      pluginId,
      JSON.stringify({
        ...JSON.parse(localStorage.getItem(pluginId)),
        ...data,
      })
    );
  }

  const context = {
    product: null,
    version: null,
    subProduct: null,
  };

  function loadContext() {
    const path = window.location.pathname;

    const pageContext = {
      product: null,
      version: null,
      subProduct: null,
    };

    if (path.includes("experience-manager")) {
      // Defaults
      pageContext.product = "experience-manager";
      context.version = "cloud-service";
      context.subProduct = "foundation";

      if (path.includes("experience-manager-65")) {
        pageContext.version = "6-5";
      } else if (
        ["/experience-manager-cloud-service", "/experience-manager-assets-essentials"].some((subPath) =>
          path.includes(subPath)
        )
      ) {
        pageContext.version = "cloud-service";
      }

      if (
        ["/sites/", "/universal-editor/"].some((subPath) =>
          path.includes(subPath)
        )
      ) {
        pageContext.subProduct = "sites";
      } else if (
        [
          "/assets/",
          "/dynamic-media/",
          "/experience-manager-assets-essentials/",
          "/experience-manager-desktop-app/",
          "/experience-manager-brand-portal/",
        ].some((subPath) => path.includes(subPath))
      ) {
        pageContext.subProduct = "assets";
      } else if (
        ["/forms/", "/getting-started-with-aem-headless/"].some((subPath) =>
          path.includes(subPath)
        )
      ) {
        pageContext.subProduct = "forms";
      } else if (
        ["/headless/", "/getting-started-with-aem-headless/"].some((subPath) =>
          path.includes(subPath)
        )
      ) {
        pageContext.subProduct = "headless";
      } else if (
        ["/release-notes/", "/implementing/"].some((subPath) =>
          path.includes(subPath)
        )
      ) {
        // fallback to local context
      } else {
        pageContext.subProduct = "foundation";
      }
    } else if (path.includes("analytics")) {
      pageContext.product = "analytics";
    }

    const localContext = JSON.parse(localStorage.getItem(pluginId)) || {};

    if (!pageContext.product) {
      // If cannot figure out he product from the page context, then set to the last known product
      context.product = localContext.current || context.subProduct;
    } else {
      context.product = pageContext.product || context.subProduct;
    }

    if (context.product === localContext.current && !pageContext.version) {
      // If the product is the same as the last known product, and there is no version derived from the page context, then use the last set
      context.version = localContext[context.product].version || context.version;
    } else {
      context.version = pageContext.version || context.version;
    }

    if (context.product === localContext.current && !pageContext.subProduct) {
      context.subProduct = localContext[context.product].subProduct || context.subProduct;
    } else {
      context.subProduct = pageContext.subProduct || context.subProduct;
    }

    if (context.product) {
      setSelectContext("products", context.product);

      // Remove "Select an app" option
      document
        .querySelectorAll('select[data-js-acde-context="products"] option')
        .forEach((el) => {
          if (!el.value) {
            el.remove();
          }
        });
    }

    setSelectContext("versions", context.version);
    setSelectContext("subProducts", context.subProduct);
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

  function setSelectContext(contextName, value) {
    const el = document.querySelector(
      `select[data-js-acde-context="${contextName}"]`
    );

    if (el) {
      el.value = value;
    }
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

  (async () => {
    let response;

    loadContext();

    console.log(
      "First menu context",
      context.product,
      context.version,
      context.subProduct
    );
    setSelectContext("products", context.product);

    if (!context.product) {
      document.querySelector(`[data-js-acde-content-types]`).style.visibility =
        "hidden";
    } else {
      document.querySelector(`[data-js-acde-content-types]`).style.display =
        "visible";
    }

    try {
      response = await fetch(`${MENU_HOST}/${context.product}/versions.html`);

      if (response.ok) {
        showContext("versions", await response.text());
        setSelectContext("versions", context.product);

        response = await fetch(
          `${MENU_HOST}/${context.product}/${context.version}/sub-products.html`
        );

        response.ok
          ? showContext("subProducts", await response.text())
          : hideContext("subProducts");
        setSelectContext("subProducts", context.subProducts);

        getContext().version.addEventListener("change", async () => {
          response = await fetch(
            `${MENU_HOST}/${context.product}/${context.version}/sub-products.html`
          );

          response.ok
            ? showContext("subProducts", await response.text())
            : hideContext("subProducts");

          setSelectContext("subProducts", context.subProducts);
        });
      } else {
        hideContext("versions");
        hideContext("subProducts");
      }
    } catch (error) {
      console.error("Error fetching context", error);
    }

    loadContext();

    console.log(
      "Menu context after injecting dropdowns",
      context.product,
      context.version,
      context.subProduct
    );

    async function getMenu(contentType) {
      let path = `${context.product}`;

      if (getContext().version?.value) {
        path += "/" + context.version;
      }

      if (getContext().subProduct?.value) {
        path += "/" + context.subProduct;
      }

      if (contentType) {
        path += "/" + contentType;
      }

      path += ".html";

      const response = await fetch(`${MENU_HOST}/${path}`);
      document.querySelector(`[data-js-acde-menu]`).innerHTML = response.ok
        ? await response.text()
        : `<h3 class="title">Menu not yet defined :(</h3>
          <div class="content">          
            The product menu feature is in beta, and not defined at this time.
            <br/>
            If you would like to contribute a menu, please contact dgonzale@adobe.com on Slack.
            <br/>
            Please remember this menu is NOT part of Experience League, but rather injected only for you via the AdobeDocs Chrome extension.
            <br/>
            To remove this menu, goto the AdobeDocs Chrome extension options and remove the beta code "menu".
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
      context.product = event.target.value;
      setLocalStorage();
      const url = event.target
        .querySelector(`option[value="${event.target.value}"]`)
        ?.getAttribute("data-js-acde-url");
      if (url) {
        window.location = url;
      }
    });

    getContext().version.addEventListener("change", (event) => {
      context.version = event.target.value;
      setLocalStorage();
      const url = event.target
        .querySelector(`option[value="${event.target.value}"]`)
        ?.getAttribute("data-js-acde-url");
      if (url) {
        window.location = url;
      }
    });

    getContext().subProduct.addEventListener("change", (event) => {
      context.subProduct = event.target.value;

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
