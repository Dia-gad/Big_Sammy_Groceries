const pool = require('../config/database');

/**
 * Record an inventory movement and update variant stock.
 *
 * This is the central inventory engine.
 * Stock should be changed through this function rather
 * than by directly modifying product_variants.stock_quantity.
 */
const recordMovement = async ({
    variantId,
    movementType,
    quantity,
    referenceType = null,
    referenceId = null,
    reason = null,
    createdBy = null,
    client = pool
}) => {
    if (!variantId) {
        throw new Error('Variant ID is required');
    }

    if (!quantity || quantity <= 0) {
        throw new Error('A positive quantity is required');
    }

    const allowedMovementTypes = [
        'purchase',
        'sale',
        'adjustment',
        'return',
        'damage',
        'expired',
        'transfer'
    ];

    if (!allowedMovementTypes.includes(movementType)) {
        throw new Error('Invalid inventory movement type');
    }

    /*
     * Lock the variant row.
     *
     * FOR UPDATE prevents two transactions from changing
     * the same stock balance at the same time.
     */
    const variantResult = await client.query(
        `
        SELECT
            pv.id,
            pv.product_id,
            pv.stock_quantity,
            pv.is_available,
            p.name AS product_name
        FROM product_variants pv
        JOIN products p
            ON p.id = pv.product_id
        WHERE pv.id = $1
        FOR UPDATE
        `,
        [variantId]
    );

    if (variantResult.rows.length === 0) {
        const error = new Error('Product variant not found');
        error.statusCode = 404;
        throw error;
    }

    const variant = variantResult.rows[0];

    const currentStock = variant.stock_quantity;

    let newStock;

    if (['purchase', 'return'].includes(movementType)) {
        newStock = currentStock + quantity;
    } else if (
        ['sale', 'damage', 'expired', 'transfer'].includes(movementType)
    ) {
        newStock = currentStock - quantity;
    } else if (movementType === 'adjustment') {
        throw new Error(
            'Adjustment requires the approved adjustment workflow'
        );
    }

    if (newStock < 0) {
        const error = new Error('Insufficient stock');
        error.statusCode = 400;
        throw error;
    }

    /*
     * Update the variant stock.
     */
    await client.query(
        `
        UPDATE product_variants
        SET
            stock_quantity = $1,
            is_available = CASE
                WHEN $1 > 0 THEN TRUE
                ELSE FALSE
            END,
            updated_at = CURRENT_TIMESTAMP
        WHERE id = $2
        `,
        [newStock, variantId]
    );

    /*
     * Record the movement for auditing.
     */
    const movementResult = await client.query(
        `
        INSERT INTO inventory_movements (
            product_id,
            variant_id,
            movement_type,
            quantity,
            reference_type,
            reference_id,
            previous_stock,
            new_stock,
            reason,
            created_by
        )
        VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)
        RETURNING *
        `,
        [
            variant.product_id,
            variantId,
            movementType,
            quantity,
            referenceType,
            referenceId,
            currentStock,
            newStock,
            reason,
            createdBy
        ]
    );

    return {
        movement: movementResult.rows[0],
        stock: {
            variantId,
            productId: variant.product_id,
            productName: variant.product_name,
            previousStock: currentStock,
            newStock,
            quantityChanged: quantity,
            movementType
        }
    };
};


/**
 * Get all inventory variants.
 */
const getInventory = async () => {
    const result = await pool.query(
        `
        SELECT
            pv.id AS variant_id,
            pv.product_id,
            p.name AS product_name,
            pu.name AS unit,
            pu.abbreviation,
            pv.sku,
            pv.price,
            pv.stock_quantity,
            pv.is_available,
            pv.options,
            pv.updated_at
        FROM product_variants pv
        JOIN products p
            ON p.id = pv.product_id
        JOIN product_units pu
            ON pu.id = pv.unit_id
        ORDER BY p.name ASC, pv.id ASC
        `
    );

    return result.rows;
};


/**
 * Get inventory for one variant.
 */
const getVariantInventory = async (variantId) => {
    const result = await pool.query(
        `
        SELECT
            pv.id AS variant_id,
            pv.product_id,
            p.name AS product_name,
            pu.name AS unit,
            pu.abbreviation,
            pv.sku,
            pv.price,
            pv.stock_quantity,
            pv.is_available,
            pv.options,
            pv.updated_at
        FROM product_variants pv
        JOIN products p
            ON p.id = pv.product_id
        JOIN product_units pu
            ON pu.id = pv.unit_id
        WHERE pv.id = $1
        `,
        [variantId]
    );

    if (result.rows.length === 0) {
        const error = new Error('Product variant not found');
        error.statusCode = 404;
        throw error;
    }

    return result.rows[0];
};


/**
 * Get inventory movement history for one variant.
 */
const getInventoryMovements = async (variantId) => {
    const result = await pool.query(
        `
        SELECT
            im.id,
            im.product_id,
            im.variant_id,
            p.name AS product_name,
            pu.name AS unit,
            im.movement_type,
            im.quantity,
            im.reference_type,
            im.reference_id,
            im.previous_stock,
            im.new_stock,
            im.reason,
            im.created_by,
            im.created_at
        FROM inventory_movements im
        JOIN products p
            ON p.id = im.product_id
        JOIN product_variants pv
            ON pv.id = im.variant_id
        JOIN product_units pu
            ON pu.id = pv.unit_id
        WHERE im.variant_id = $1
        ORDER BY im.created_at DESC, im.id DESC
        `,
        [variantId]
    );

    return result.rows;
};


module.exports = {
    recordMovement,
    getInventory,
    getVariantInventory,
    getInventoryMovements
};