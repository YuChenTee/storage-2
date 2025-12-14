async function restoreBackup(backupId) {
    const collectionsToRestore = [
        'buffer', 'history', 'materials', 'numOfDays', 
        'orders', 'product_list', 'products', 'salesOrder', 'thresholds'
    ];

    try {
        for (const collection of collectionsToRestore) {
            const backupCollectionName = `${collection}_backup_${backupId}`;
            const targetCollectionName = collection;

            console.log(`Restoring ${backupCollectionName} to ${targetCollectionName}...`);

            // Step 1: Delete current data in target collection
            await deleteCollection(targetCollectionName);

            // Step 2: Copy data from backup to original
            await duplicateCollection(backupCollectionName, targetCollectionName);
        }

        console.log(`✅ Successfully restored all collections from backup ID: ${backupId}`);
    } catch (error) {
        console.error(`❌ Error restoring backup ${backupId}:`, error);
    }
}

async function renameMaterialName(oldName, newName) {
    try {

        // === 2. history.collection('history').doc(oldName) ===
        const oldHistoryRef = db.collection('history').doc(oldName);
        const newHistoryRef = db.collection('history').doc(newName);
        const oldHistorySnap = await oldHistoryRef.get();
        if (oldHistorySnap.exists) {
            await newHistoryRef.set(oldHistorySnap.data());
            await oldHistoryRef.delete();
        }

        // === 3. materials.collection('materials').doc('materials') ===
        const materialsRef = db.collection('materials').doc('materials');
        const materialsSnap = await materialsRef.get();
        if (materialsSnap.exists && materialsSnap.data()[oldName] !== undefined) {
            const materialsData = materialsSnap.data();
            materialsData[newName] = materialsData[oldName];
            delete materialsData[oldName];
            await materialsRef.set(materialsData);
        }

        // === 4. orders.collection('orders').doc('orders') ===
        const ordersRef = db.collection('orders').doc('orders');
        const ordersSnap = await ordersRef.get();
        if (ordersSnap.exists) {
            const ordersData = ordersSnap.data();
            for (const orderId in ordersData) {
                if (ordersData[orderId].materialKey === oldName) {
                    ordersData[orderId].materialKey = newName;
                }
            }
            await ordersRef.set(ordersData);
        }

        // === 5. products.collection('products').doc(*) ===
        const productsSnap = await db.collection('products').get();
        for (const doc of productsSnap.docs) {
            const productData = doc.data();
            if (productData[oldName] !== undefined) {
                const newProductData = { ...productData };
                newProductData[newName] = newProductData[oldName];
                delete newProductData[oldName];
                await db.collection('products').doc(doc.id).set(newProductData);
            }
        }

        // === 6. thresholds.collection('thresholds').doc('thresholds') ===
        const thresholdsRef = db.collection('thresholds').doc('thresholds');
        const thresholdsSnap = await thresholdsRef.get();
        if (thresholdsSnap.exists && thresholdsSnap.data()[oldName] !== undefined) {
            const thresholdsData = thresholdsSnap.data();
            thresholdsData[newName] = thresholdsData[oldName];
            delete thresholdsData[oldName];
            await thresholdsRef.set(thresholdsData);
        }

        console.log(`✅ Successfully renamed "${oldName}" to "${newName}" across all relevant collections.`);
    } catch (error) {
        console.error(`❌ Error renaming material:`, error);
    }
}

async function renameProductEverywhere(oldName, newName) {
    const batch = db.batch();

    console.log(`Renaming product from "${oldName}" to "${newName}"...`);

    // 1️⃣ Move product document in "products" collection
    const oldDocRef = db.collection('products').doc(oldName);
    const newDocRef = db.collection('products').doc(newName);
    const oldDoc = await oldDocRef.get();

    if (!oldDoc.exists) {
        console.error(`Product "${oldName}" not found in 'products' collection.`);
        return;
    }

    // Copy data to new doc
    batch.set(newDocRef, oldDoc.data());
    batch.delete(oldDocRef);

    // 2️⃣ Update product_list document
    const productListRef = db.collection('product_list').doc('product_list');
    const productListDoc = await productListRef.get();

    if (productListDoc.exists) {
        const data = productListDoc.data();
        const newData = {};

        for (const key in data) {
            // update key
            const newKey = key.includes(oldName) ? key.replace(oldName, newName) : key;

            // update value
            let value = data[key];
            if (typeof value === "string") {
                value = value.replace(oldName, newName);
            }

            newData[newKey] = value;
        }

        batch.set(productListRef, newData);
    }

    // 3️⃣ Update all sales orders
    const salesOrdersRef = db.collection('salesOrder').doc('salesOrder');
    const salesOrdersSnap = await salesOrdersRef.get();

    if (salesOrdersSnap.exists) {
        const soData = salesOrdersSnap.data();
        const updatedSalesOrders = {};

        for (const orderId in soData) {
            const order = soData[orderId];

            if (!Array.isArray(order.products)) {
                updatedSalesOrders[orderId] = order;
                continue;
            }

            const updatedProducts = order.products.map(p => {
                if (p.product === oldName) {
                    return { ...p, product: newName };
                }
                return p;
            });

            updatedSalesOrders[orderId] = {
                ...order,
                products: updatedProducts
            };
        }

        batch.set(salesOrdersRef, updatedSalesOrders);
    }

    // 4️⃣ Update buffer and numOfDays collections
    for (const collectionName of ['buffer', 'numOfDays']) {
        const ref = db.collection(collectionName).doc(collectionName);
        const docSnap = await ref.get();
        if (docSnap.exists) {
            const data = docSnap.data();
            const newData = {};
            for (const key in data) {
                const newKey = key === oldName ? newName : key;
                newData[newKey] = data[key];
            }
            batch.set(ref, newData);
        }
    }

    // 5️⃣ Commit all updates atomically
    await batch.commit();
    console.log(`✅ Product "${oldName}" successfully renamed to "${newName}" everywhere!`);
}
