// Cache for product list, product details, and materials
let cachedProductList = {};
let cachedProductDetails = {};
let cachedMaterials = {};
let cachedThresholds = {};
let cachedMaterialHistory = {};
let cachedOrders = {};
let cachedSalesOrders = {};
let cachedBuffers = {};
let cachedDays = {};

const db = firebase.firestore();

// On window load, initialize everything
window.onload = function() {
    // Find the link element for the "Material Check" section
    const materialCheckLink = document.querySelector('nav ul li a[href="#"]');
    showSection('materialList', materialCheckLink);
    initializeSelect2();
    initializeThresholdCache();
    initializeProductCacheAndDropdowns();
    initializeMaterialCacheAndDropdowns();
    initializeOrderCacheAndDropdowns();
    initializeSalesOrderCacheAndDropdowns();
    handleMaterialCheckFormSubmission();
    handleUpdateMaterialFormSubmission();
    handleCreateMaterialFormSubmission();
    handleSetThresholdFormSubmission();
    populateDropdowns();
    handleCreateProductMaterialSelection();
    handleCreateProductFormSubmission();
    handleRemoveProductFormSubmission();
    handleEditProductMaterialSelection();
    handleEditProductFormSubmission();
    handleAddPendingMaterialFormSubmission();
    handleMoveToInventoryFormSubmission();
    handleAddSalesOrderFormSubmission();
    handleSalesOrderFormSubmission();
    fetchBuffersFromDB();
};