// Function to fetch product list from database and store it in a variable
function fetchProductListfromDB() {
    console.log("Fetching product list from 'product_list' collection...");
    return db.collection("product_list").doc("product_list").get().then((doc) => {
        if (doc.exists) {
            console.log("Product list retrieved from database.");
            cachedProductList = doc.data();
            return cachedProductList;
        } else {
            console.error("Product list document not found.");
            return null;
        }
    }).catch((error) => {
        console.error("Error fetching product list: ", error);
        return null;
    });
}

// Function to fetch materials from database and store it in a variable
function fetchMaterialListfromDB() {
    console.log("Fetching materials from 'materials' collection...");
    return db.collection("materials").doc("materials").get().then((doc) => {
        if (doc.exists) {
            console.log("Material list retrieved from database.");
            cachedMaterials = doc.data();
            return cachedMaterials;
        } else {
            console.error("Materials data not found.");
            return null;
        }
    }).catch((error) => {
        console.error("Error fetching materials: ", error);
        return null;
    });
}

// Function to fetch threshold data from the database and store it in a variable
function fetchThresholdDatafromDB() {
    console.log("Fetching thresholds from 'thresholds' collection...");
    return db.collection("thresholds").doc("thresholds").get().then((doc) => {
        if (doc.exists) {
            console.log("Threshold data retrieved from database.");
            cachedThresholds = doc.data();
            return cachedThresholds;
        } else {
            console.error("Thresholds data not found.");
            return null;
        }
    }).catch((error) => {
        console.error("Error fetching thresholds: ", error);
        return null;
    });
}

async function fetchOrdersFromDB() {
    console.log("Fetching orders from 'orders' collection...");
    return db.collection("orders").doc("orders").get().then((doc) => {
        if (doc.exists) {
            console.log("Orders retrieved from database.");
            cachedOrders = doc.data();
            return cachedOrders;
        } else {
            console.error("Orders data not found.");
            return null;
        }
    }).catch((error) => {
        console.error("Error fetching orders: ", error);
        return null;
    });
}

async function fetchSalesOrdersFromDB() {
    console.log("Fetching sales orders from 'salesOrder' collection...");
    return db.collection("salesOrder").doc("salesOrder").get().then((doc) => {
        if (doc.exists) {
            console.log("Sales orders retrieved from database.");
            cachedSalesOrders = doc.data();
            return cachedSalesOrders;
        } else {
            console.error("Sales orders data not found.");
            return null;
        }
    }).catch((error) => {
        console.error("Error fetching sales orders: ", error);
        return null;
    });
}

async function fetchBuffersFromDB() {
    console.log("Fetching buffers from 'buffers' collection...");
    return db.collection("buffer").doc("buffer").get().then((doc) => {
        if (doc.exists) {
            console.log("Buffers retrieved from database.");
            cachedBuffers = doc.data();
            return cachedBuffers;
        } else {
            console.error("Buffers data not found.");
            return null;
        }
    }).catch((error) => {
        console.error("Error fetching buffers: ", error);
        return null;
    });
}

// fetch number of days from db
async function fetchDaysFromDB() {
    console.log("Fetching days from 'numOfDays' collection...");
    return db.collection("numOfDays").doc("numOfDays").get().then((doc) => {
        if (doc.exists) {
            console.log("Days retrieved from database.");
            cachedDays = doc.data();
            return cachedDays;
        } else {
            console.error("Days data not found.");
            return null;
        }
    }).catch((error) => {
        console.error("Error fetching days: ", error);
        return null;
    });
}

// Function to initialize product cache and populate related dropdowns
function initializeProductCacheAndDropdowns() {
    fetchProductListfromDB().then(() => {
        populateProductDropdown(cachedProductList);
        handleEditProductSelection();
    }).catch(error => {
        console.error("Error initializing product cache: ", error);
    });
}

// Function to initialize material cache and populate related dropdowns
function initializeMaterialCacheAndDropdowns() {
    fetchMaterialListfromDB().then(() => {
        populateMaterialDropdown(cachedMaterials);
        handleMaterialSelection();
        populateBatchInfoTable();
    }).catch(error => {
        console.error("Error initializing material cache: ", error);
    });
}

// Function to initialize threshold cache
function initializeThresholdCache() {
    fetchThresholdDatafromDB().then(() => {
        populateMaterialList();
        console.log("Threshold cache initialized.");
    }).catch(error => {
        console.error("Error initializing threshold cache: ", error);
    });
}

function initializeOrderCacheAndDropdowns() {
    fetchOrdersFromDB().then(() => {
        console.log("Order cache initialized.");
        populatePendingOrders();
    }).catch(error => {
        console.error("Error initializing order cache: ", error);
    });
}

function initializeSalesOrderCacheAndDropdowns() {
    fetchSalesOrdersFromDB().then(() => {
        console.log("Sales order cache initialized.");
        populateSalesOrders();
        populateEditSalesOrderDropdown();
    }).catch(error => {
        console.error("Error initializing sales order cache: ", error);
    });
}