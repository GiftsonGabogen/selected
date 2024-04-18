let tab = "single";

document.getElementById("single-tab").addEventListener("click", function (e) {
  e.preventDefault();
  document.getElementById("single-content").classList.remove("hidden");
  document.getElementById("multiple-content").classList.add("hidden");
  tab = "single";
});

document.getElementById("multiple-tab").addEventListener("click", function (e) {
  e.preventDefault();
  document.getElementById("multiple-content").classList.remove("hidden");
  document.getElementById("single-content").classList.add("hidden");
  tab = "multiple";
});

document.getElementById("clear").addEventListener("click", function (e) {
  document.getElementById("context-element").value = "";
  document.getElementById("reference-element").value = "";
  document.getElementById("main-element").value = "";
});

(function () {
  // Initialize variables
  let isListening = false;
  let inputsFilled = 0;
  let selectionListener = null;
  const inputIds = ["context-element", "reference-element", "main-element"];
  const startStopButton = document.getElementById("start-stop-button");

  // Function to handle the selection of elements
  function handleElementSelection() {
    // If there's already a listener, remove it first to prevent duplicates
    if (selectionListener) {
      chrome.devtools.panels.elements.onSelectionChanged.removeListener(
        selectionListener
      );
    }

    // Define the new listener for element selection
    selectionListener = function () {
      chrome.devtools.inspectedWindow.eval(
        "$0.outerHTML",
        function (result, isException) {
          if (isException) {
            console.error("Error fetching outerHTML:", isException);
            return;
          }
          // Check if we have filled less than three inputs
          if (inputsFilled < 3) {
            const currentInput = document.getElementById(
              inputIds[inputsFilled]
            );
            if (currentInput) {
              currentInput.value = result; // Set the result to the input
              inputsFilled++;
              // If three inputs are filled, remove the listener and reset
              if (inputsFilled === 3) {
                chrome.devtools.panels.elements.onSelectionChanged.removeListener(
                  selectionListener
                );
                selectionListener = null; // Clear the stored listener
                toggleListener(false); // Turn off the listener and reset the UI
              }
            }
          }
        }
      );
    };

    // Add the newly defined listener
    chrome.devtools.panels.elements.onSelectionChanged.addListener(
      selectionListener
    );
  }

  // Function to toggle the selection listener on or off
  function toggleListener(activate) {
    isListening = activate;
    if (activate) {
      handleElementSelection(); // Add the listener
      startStopButton.textContent = "Stop";
    } else {
      // Remove the listener if it exists and reset UI
      if (selectionListener) {
        chrome.devtools.panels.elements.onSelectionChanged.removeListener(
          selectionListener
        );
        selectionListener = null;
      }
      startStopButton.textContent = "Start";
      inputsFilled = 0;
    }
  }

  // Event listener for the start/stop button
  startStopButton.addEventListener("click", function () {
    toggleListener(!isListening);
  });

  // Make sure to add any additional initialization logic if needed
})();

function findNearestCommonAncestor(contextHTML, referenceHTML, mainHTML) {
  // Parse the HTML strings into DOM elements
  const parser = new DOMParser();
  const contextDoc = parser.parseFromString(contextHTML, "text/html");

  // Find the elements that contain the reference and main HTML strings
  const referenceElements = Array.from(contextDoc.querySelectorAll("*"))
    .filter((el) => el.innerHTML.includes(referenceHTML))
    .reverse();
  const mainElements = Array.from(contextDoc.querySelectorAll("*"))
    .filter((el) => {
      return el.innerHTML.includes(mainHTML);
    })
    .reverse();

  // Helper function to get all ancestors of a node
  function getAncestors(node) {
    const ancestors = [];
    while (node && node !== contextDoc.body) {
      ancestors.unshift(node); // unshift to add to the beginning of the array
      node = node.parentNode;
    }
    return ancestors;
  }

  // Find the nearest common ancestor
  console.log("Find the nearest common ancestor");
  if (referenceElements.length > 0 && mainElements.length > 0) {
    for (let i = 0; i < referenceElements.length; i++) {
      if (mainElements.includes(referenceElements[i])) {
        return referenceElements[i].outerHTML; // Return the outerHTML of the common ancestor
      }
    }
  }

  // If no common ancestor is found
  return null;
}

function generateParentXPath(htmlString) {
  // Parse the HTML string into a DOM object
  const parser = new DOMParser();
  const doc = parser.parseFromString(htmlString, "text/html");
  const element = doc.body.firstElementChild;

  // Function to generate XPath for the parent of an element
  function xpathForElement(el) {
    let xpath = el.tagName.toLowerCase(); // Start with the tag name of the parent
    const attributes = el.attributes;
    const attrConditions = [];

    // Handle ID attribute
    if (attributes.id) {
      attrConditions.push(`@id="${attributes.id.value}"`);
    }

    // Handle classes, differentiating dynamic classes
    if (attributes.class) {
      const classes = attributes.class.value.split(/\s+/);
      let classesCount = 0;
      classes.forEach((cls) => {
        classesCount++;
        if (cls && classesCount <= 2) {
          if (cls.includes("--")) {
            // Dynamic class handling for special identifiers
            attrConditions.push(`contains(@class, "${cls.split("--")[0]}--")`);
          } else {
            // Regular class handling
            attrConditions.push(`contains(@class, "${cls}")`);
          }
        }
      });
    }

    const directText = Array.from(el.childNodes)
      .filter((node) => node.nodeType === Node.TEXT_NODE)
      .map((node) => node.textContent.trim())
      .filter((text) => text.length > 0)
      .join(" ");

    if (directText) {
      attrConditions.push(`normalize-space()="${directText}"`);
    }

    // Combine conditions into XPath
    if (attrConditions.length) {
      xpath += `[${attrConditions.join(" and ")}]`;
    }

    return xpath;
  }

  return xpathForElement(element);
}

let direct = true;

document.getElementById("direct").addEventListener("click", () => {
  direct = !direct;
  document.getElementById("direct").innerText = direct ? "Direct" : "InDirect";
});

// Example usage
document.getElementById("create-xpath").addEventListener("click", () => {
  let contextElement = document.getElementById("context-element").value; // Use actual selected context element
  let referenceElement = document.getElementById("reference-element").value; // Use actual selected reference element
  let mainElement = document.getElementById("main-element").value; // Use actual selected main element

  const nearestCommonAncestor = findNearestCommonAncestor(
    contextElement,
    referenceElement,
    mainElement
  );

  const contextXpath = generateParentXPath(contextElement);
  const referenceXpath = generateParentXPath(referenceElement);
  const mainXpath = generateParentXPath(mainElement);
  const nearestCommonAncestorXpath = generateParentXPath(nearestCommonAncestor);

  let connector = direct
    ? "//"
    : "//ancestor::" + nearestCommonAncestorXpath + "//";

  const finalPath = `//${contextXpath}//${referenceXpath}${connector}${mainXpath}`;

  document.getElementById("xpath-result").value = finalPath;
});

//multiple
document.addEventListener("DOMContentLoaded", function () {
  let excludeCount = 1;

  document
    .getElementById("add-exclude")
    .addEventListener("click", addExcludeInput);

  function addExcludeInput() {
    const excludeSection = document.getElementById("exclude-section");
    const newInputDiv = document.createElement("div");
    newInputDiv.className = "mb-4 flex items-center";
    const newInputId = `exclude-element-${excludeCount}`;
    newInputDiv.innerHTML = `
          <input id="${newInputId}" type="text" class="shadow appearance-none border rounded w-full py-2 px-3 text-gray-700 leading-tight focus:outline-none focus:shadow-outline" />
          <button class="remove-exclude ml-2 bg-red-500 hover:bg-red-700 text-white font-bold py-2 px-4 rounded">Remove</button>
      `;
    excludeSection.appendChild(newInputDiv);

    const removeButton = newInputDiv.querySelector(".remove-exclude");
    removeButton.addEventListener("click", function () {
      removeInput(newInputDiv);
    });

    excludeCount++;
  }

  function removeInput(divElement) {
    divElement.remove();
  }
});

// For multiple-content
// Assuming you have buttons with ids: select-multi-context, select-multi-main, select-multi-parent
function handleElementSelectionMultiple(inputId) {
  // Set the active input ID.
  activeInputId = inputId;

  // Listen to the selection changes in the Elements panel.
  chrome.devtools.panels.elements.onSelectionChanged.addListener(function () {
    if (activeInputId) {
      chrome.devtools.inspectedWindow.eval(
        "$0.outerHTML",
        function (result, isException) {
          if (!isException) {
            document.getElementById(activeInputId).value = result;
            // Reset the active input ID.
            activeInputId = null;
          } else {
            console.error(
              "Could not get element outerHTML:",
              JSON.stringify(isException)
            );
          }
        }
      );
    }
  });
}

// Attach the handleElementSelection function to the select button for each input.
document
  .getElementById("select-multi-context")
  .addEventListener("click", function () {
    handleElementSelectionMultiple("multi-context-element");
  });
document
  .getElementById("select-multi-main")
  .addEventListener("click", function () {
    handleElementSelectionMultiple("multi-main-element");
  });
document
  .getElementById("select-multi-parent")
  .addEventListener("click", function () {
    handleElementSelectionMultiple("multi-parent-element");
  });

let excludeInputs = [];
let isListeningForExclude = false;
let startStopExcludeButton = document.getElementById("start-exclude-process");

// This function listens for element selections and fills exclude inputs accordingly
function listenForExcludeSelections() {
  chrome.devtools.panels.elements.onSelectionChanged.addListener(function () {
    if (excludeInputs.length > 0 && isListeningForExclude) {
      chrome.devtools.inspectedWindow.eval(
        "$0.outerHTML",
        function (result, isException) {
          if (!isException && excludeInputs.length > 0) {
            let inputId = excludeInputs.shift(); // Get the next input to fill
            document.getElementById(inputId).value = result;
            if (excludeInputs.length === 0) {
              // Stop listening if all inputs are filled
              isListeningForExclude = false;
              startStopExcludeButton.textContent = "Start";
            }
          }
        }
      );
    }
  });
}

// Toggle start/stop listening for element selection to fill exclude inputs
startStopExcludeButton.addEventListener("click", function () {
  isListeningForExclude = !isListeningForExclude;
  if (isListeningForExclude) {
    // Gather all exclude input IDs
    excludeInputs = Array.from(
      document.querySelectorAll("[id^='exclude-element-']")
    ).map((input) => input.id);
    listenForExcludeSelections();
    startStopExcludeButton.textContent = "Stop";
  } else {
    // Reset
    excludeInputs = [];
    startStopExcludeButton.textContent = "Start";
  }
});

document
  .getElementById("clear-multiple")
  .addEventListener("click", function () {
    // Clear all inputs in the "multiple" content area
    document
      .querySelectorAll("#multiple-content input[type='text']")
      .forEach((input) => {
        input.value = "";
      });

    // Stop listening for clicks in the inspector if we are currently listening
    if (isListeningForExclude) {
      isListeningForExclude = false;
      chrome.devtools.panels.elements.onSelectionChanged.removeListener(
        listenForExcludeSelections
      );
      startStopExcludeButton.textContent = "Start";
    }
  });

document
  .getElementById("create-xpath-multiple")
  .addEventListener("click", () => {
    let contextElement = document.getElementById(
      "context-multiple-element"
    ).value; // Use actual selected context element
    let parentElement = document.getElementById(
      "parent-multiple-element"
    ).value; // Use actual selected reference element

    const contextXpath = generateParentXPath(contextElement);
    const parentXpath = generateParentXPath(parentElement);

    const finalPath = `//${contextXpath}//${parentXpath}/`;

    document.getElementById("xpath-multiple-result").value = finalPath;
  });

// get all the children
// use exclude items if available get the element then get it's index based on it's siblings
// then exclude that item by index
// use the index selector [0, 5] if available
// if all the children that should be included are selected, get their selector and if there is
// dynamic value(difference), remove that selector or text and build the xpath
