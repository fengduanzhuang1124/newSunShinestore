// 订单管理相关功能
document.addEventListener('DOMContentLoaded', function() {
    // 初始化重量修改功能
    initWeightEditFunctions();
});

// 初始化重量修改功能
function initWeightEditFunctions() {
    // 绑定重量输入变化事件
    const newWeightInput = document.getElementById('edit-new-weight');
    const quantityInput = document.getElementById('edit-quantity');
    const regionSelect = document.getElementById('edit-shipping-region');
    
    if (newWeightInput) {
        newWeightInput.addEventListener('input', calculateShippingFee);
    }
    
    if (quantityInput) {
        quantityInput.addEventListener('input', calculateShippingFee);
    }
    
    if (regionSelect) {
        regionSelect.addEventListener('change', calculateShippingFee);
    }
}

// 打开修改重量模态框
function editProductWeight(orderId, currentWeight) {
    const modal = document.getElementById('edit-weight-modal');
    if (!modal) return;
    
    // 填充当前数据
    document.getElementById('edit-product-name').value = '商品名称'; // 这里应该从订单数据中获取
    document.getElementById('edit-current-weight').value = currentWeight + 'kg';
    document.getElementById('edit-new-weight').value = currentWeight;
    document.getElementById('edit-quantity').value = 1;
    document.getElementById('edit-shipping-region').value = 'mainland';
    
    // 存储当前编辑的订单ID
    modal.setAttribute('data-order-id', orderId);
    
    // 显示模态框
    modal.style.display = 'flex';
    document.body.style.overflow = 'hidden';
    
    // 计算初始运费
    calculateShippingFee();
}

// 关闭修改重量模态框
function closeEditWeightModal() {
    const modal = document.getElementById('edit-weight-modal');
    if (modal) {
        modal.style.display = 'none';
        document.body.style.overflow = 'auto';
        modal.removeAttribute('data-order-id');
    }
}

// 计算运费
function calculateShippingFee() {
    const newWeight = parseFloat(document.getElementById('edit-new-weight').value) || 0;
    const quantity = parseInt(document.getElementById('edit-quantity').value) || 1;
    const region = document.getElementById('edit-shipping-region').value;
    
    const totalWeight = newWeight * quantity;
    const shippingFee = getShippingFeeByRegion(region, totalWeight);
    
    // 更新显示
    document.getElementById('total-weight-display').textContent = totalWeight.toFixed(2) + 'kg';
    document.getElementById('shipping-fee-display').textContent = '$' + shippingFee.toFixed(2);
}

// 根据重量计算运费
function getShippingFeeByRegion(region, totalWeight, productBrand = '', deliveryRegion = '', orderAmount = 0) {
    let baseFee = 0;
    
    // 中国大陆标准运费
    if (region === 'mainland') {
        // 最低1公斤，不足1公斤按1公斤计算
        const calculatedWeight = Math.max(1, Math.ceil(totalWeight));
        baseFee = calculatedWeight * 7.99;
    }
    
    // 新西兰本地：订单金额超过200纽币免邮，否则按7.99纽币/公斤计算
    if (region === 'nz') {
        if (orderAmount >= 200) {
            baseFee = 0; // 免邮
        } else {
            // 最低1公斤，不足1公斤按1公斤计算
            const calculatedWeight = Math.max(1, Math.ceil(totalWeight));
            baseFee = calculatedWeight * 7.99;
        }
    }
    
    // 澳洲奶粉免邮
    if (region === 'au') {
        baseFee = 0;
    }
    
    // 偏远地区额外运费
    if (region === 'remote') {
        const remoteRegions = ['新疆', '西藏', '甘肃', '宁夏', '青海'];
        if (remoteRegions.includes(deliveryRegion)) {
            baseFee = 10;
        }
    }
    
    // Taopu品牌奶粉额外运费
    if (region === 'taopu' && productBrand.toLowerCase().includes('taopu')) {
        const taopuRegions = ['海南', '新疆', '甘肃', '青海', '宁夏', '内蒙古'];
        if (taopuRegions.includes(deliveryRegion)) {
            baseFee = 20;
        }
    }
    
    return baseFee;
}

// 保存商品重量
function saveProductWeight() {
    const modal = document.getElementById('edit-weight-modal');
    const orderId = modal.getAttribute('data-order-id');
    const newWeight = parseFloat(document.getElementById('edit-new-weight').value);
    const quantity = parseInt(document.getElementById('edit-quantity').value);
    const region = document.getElementById('edit-shipping-region').value;
    
    if (!newWeight || newWeight <= 0) {
        alert('请输入有效的重量！');
        return;
    }
    
    if (!quantity || quantity <= 0) {
        alert('请输入有效的数量！');
        return;
    }
    
    // 计算新的运费和总金额
    const totalWeight = newWeight * quantity;
    const shippingFee = getShippingFeeByRegion(region, totalWeight);
    
    // 获取商品单价 (这里应该从订单数据中获取，暂时使用示例数据)
    const unitPrice = 39.54; // 应该从订单数据中获取
    const productTotal = unitPrice * quantity;
    const finalTotal = productTotal + shippingFee;
    
    // 这里应该调用后端API更新订单中的商品重量和运费
    // 目前只是模拟更新
    console.log('更新订单商品重量:', {
        orderId: orderId,
        newWeight: newWeight,
        quantity: quantity,
        totalWeight: totalWeight,
        shippingFee: shippingFee,
        productTotal: productTotal,
        finalTotal: finalTotal,
        region: region
    });
    
    // 更新页面显示
    updateOrderDisplay(orderId, newWeight, quantity, shippingFee, finalTotal);
    
    // 显示成功消息
    alert(`商品重量已更新！\n新重量: ${newWeight}kg\n数量: ${quantity}件\n总重量: ${totalWeight.toFixed(2)}kg\n运费: $${shippingFee.toFixed(2)}\n实付金额: $${finalTotal.toFixed(2)}`);
    
    // 关闭模态框
    closeEditWeightModal();
}

// 更新订单显示
function updateOrderDisplay(orderId, newWeight, quantity, shippingFee, finalTotal) {
    // 查找对应的订单项
    const orderItems = document.querySelectorAll('.order-item');
    orderItems.forEach(item => {
        const orderNumber = item.querySelector('.order-number');
        if (orderNumber && orderNumber.textContent.includes(orderId)) {
            // 更新重量显示
            const weightElement = item.querySelector('.weight-value');
            if (weightElement) {
                weightElement.textContent = newWeight.toFixed(2);
            }
            
            // 更新运费显示
            const shippingFeeElement = item.querySelector('.shipping-fee-value');
            if (shippingFeeElement) {
                shippingFeeElement.textContent = shippingFee.toFixed(2);
            }
            
            // 更新实付金额显示
            const paidAmountElement = item.querySelector('.paid-amount');
            if (paidAmountElement) {
                paidAmountElement.textContent = finalTotal.toFixed(2);
            }
            
            // 更新应付金额显示
            const payableAmountElement = item.querySelector('.payable-amount');
            if (payableAmountElement) {
                payableAmountElement.textContent = finalTotal.toFixed(2);
            }
            
            // 更新订单总计
            const orderTotalElement = item.querySelector('.total-amount');
            if (orderTotalElement) {
                orderTotalElement.textContent = finalTotal.toFixed(2);
            }
            
            // 更新数量显示
            const quantityElement = item.querySelector('.quantity');
            if (quantityElement) {
                quantityElement.textContent = `数量: x${quantity}`;
            }
        }
    });
}

// 发货订单
function shipOrder(orderId) {
    if (confirm(`确定要发货订单 ${orderId} 吗？`)) {
        // 这里应该调用后端API发货
        console.log('发货订单:', orderId);
        alert('订单已发货！');
        // 重新加载订单列表
        // loadOrderList();
    }
}

// 查看物流
function viewLogistics(orderId) {
    alert(`查看订单 ${orderId} 的物流信息功能开发中...`);
}

// 修改物流
function modifyLogistics(orderId) {
    alert(`修改订单 ${orderId} 的物流信息功能开发中...`);
}

// 导出函数供HTML使用
window.editProductWeight = editProductWeight;
window.closeEditWeightModal = closeEditWeightModal;
window.saveProductWeight = saveProductWeight;
window.shipOrder = shipOrder;
window.viewLogistics = viewLogistics;
window.modifyLogistics = modifyLogistics;
