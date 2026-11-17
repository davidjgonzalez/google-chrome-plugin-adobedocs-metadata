import { initExtraMenu } from "./extra/menu/menu.js";
import { copyDeepLink } from "./extra/deeplink/index.js";
import { initMeasureImages } from "./measure-images.js";
import "./content.css";

initMeasureImages();

/** Beta  */
initExtraMenu();
copyDeepLink();