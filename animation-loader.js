// ------------------------
// REPLACE ONLY THIS PART
// ------------------------
import { wavingAnimation } from "./waving-animation.js";

// Load animation into container
lottie.loadAnimation({
    container: document.getElementById("character-waving"), // Replace container ID
    renderer: "svg",
    loop: true,
    autoplay: true,
    animationData: wavingAnimation // Replace with your custom animation
});
