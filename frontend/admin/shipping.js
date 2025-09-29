// 运费管理相关功能
document.addEventListener('DOMContentLoaded', function() {
    // 页面加载时初始化
    loadShippingRules();
    initShippingCalculator();
    
    // 绑定搜索功能
    const searchInput = document.getElementById('search-rules');
    if (searchInput) {
        searchInput.addEventListener('input', function() {
            filterShippingRules(this.value);
        });
    }
});

// 运费规则数据
let shippingRules = [
    {
        id: 'R001',
        name: '中国大陆标准运费',
        region: 'mainland',
        type: 'weight',
        minWeight: 0,
        maxWeight: 1,
        fee: 8.00,
        status: 'active',
        createTime: '2024-01-15 10:30:00'
    },
    {
        id: 'R002',
        name: '中国大陆重货运费',
        region: 'mainland',
        type: 'weight',
        minWeight: 1,
        maxWeight: 3,
        fee: 12.00,
        status: 'active',
        createTime: '2024-01-15 10:30:00'
    },
    {
        id: 'R003',
        name: '港澳台标准运费',
        region: 'hmt',
        type: 'weight',
        minWeight: 0,
        maxWeight: 1,
        fee: 15.00,
        status: 'active',
        createTime: '2024-01-15 10:30:00'
    }
];

// 地区运费配置
const regionShippingConfig = {
    mainland: {
        name: '中国大陆',
        ratePerKg: 7.99,
        minWeight: 1
    },
    nz: {
        name: '新西兰本地',
        ratePerKg: 0, // 免邮
        minWeight: 0
    },
    au: {
        name: '澳洲奶粉',
        ratePerKg: 0, // 免邮
        minWeight: 0
    },
    remote: {
        name: '偏远地区',
        ratePerKg: 0,
        minWeight: 0,
        extraFee: 10, // 偏远地区额外运费
        regions: ['新疆', '西藏', '甘肃', '宁夏', '青海']
    },
    taopu: {
        name: 'Taopu品牌奶粉',
        ratePerKg: 0,
        minWeight: 0,
        extraFee: 20, // Taopu品牌额外运费
        regions: ['海南', '新疆', '甘肃', '青海', '宁夏', '内蒙古']
    }
};

// 加载运费规则
function loadShippingRules() {
    const rulesList = document.getElementById('rules-list');
    if (!rulesList) return;
    
    rulesList.innerHTML = shippingRules.map(rule => `
        <div class="rule-item-card">
            <div class="rule-header">
                <div class="rule-info">
                    <h4>${rule.name}</h4>
                    <span class="rule-id">ID: ${rule.id}</span>
                </div>
                <div class="rule-status">
                    <span class="status-badge ${rule.status === 'active' ? 'status-active' : 'status-inactive'}">
                        ${rule.status === 'active' ? '启用' : '禁用'}
                    </span>
                </div>
            </div>
            <div class="rule-details">
                <div class="detail-item">
                    <span class="label">适用地区:</span>
                    <span class="value">${getRegionName(rule.region)}</span>
                </div>
                <div class="detail-item">
                    <span class="label">计费方式:</span>
                    <span class="value">${getTypeName(rule.type)}</span>
                </div>
                <div class="detail-item">
                    <span class="label">重量范围:</span>
                    <span class="value">${rule.minWeight}kg - ${rule.maxWeight === 999 ? '∞' : rule.maxWeight + 'kg'}</span>
                </div>
                <div class="detail-item">
                    <span class="label">运费:</span>
                    <span class="value fee">¥${rule.fee.toFixed(2)}</span>
                </div>
                <div class="detail-item">
                    <span class="label">创建时间:</span>
                    <span class="value">${rule.createTime}</span>
                </div>
            </div>
            <div class="rule-actions">
                <button class="btn btn-sm btn-primary" onclick="editRule('${rule.id}')">编辑</button>
                <button class="btn btn-sm btn-secondary" onclick="toggleRuleStatus('${rule.id}')">
                    ${rule.status === 'active' ? '禁用' : '启用'}
                </button>
                <button class="btn btn-sm btn-danger" onclick="deleteRule('${rule.id}')">删除</button>
            </div>
        </div>
    `).join('');
}

// 获取地区名称
function getRegionName(region) {
    const regionMap = {
        'mainland': '中国大陆',
        'nz': '新西兰本地',
        'au': '澳洲奶粉',
        'remote': '偏远地区',
        'taopu': 'Taopu品牌奶粉'
    };
    return regionMap[region] || region;
}

// 获取计费方式名称
function getTypeName(type) {
    const typeMap = {
        'weight': '按重量计费',
        'quantity': '按数量计费',
        'fixed': '固定运费'
    };
    return typeMap[type] || type;
}

// 筛选运费规则
function filterShippingRules(keyword) {
    const filteredRules = shippingRules.filter(rule => 
        rule.name.toLowerCase().includes(keyword.toLowerCase()) ||
        rule.id.toLowerCase().includes(keyword.toLowerCase()) ||
        getRegionName(rule.region).toLowerCase().includes(keyword.toLowerCase())
    );
    
    const rulesList = document.getElementById('rules-list');
    if (!rulesList) return;
    
    if (keyword.trim() === '') {
        loadShippingRules();
        return;
    }
    
    rulesList.innerHTML = filteredRules.map(rule => `
        <div class="rule-item-card">
            <div class="rule-header">
                <div class="rule-info">
                    <h4>${rule.name}</h4>
                    <span class="rule-id">ID: ${rule.id}</span>
                </div>
                <div class="rule-status">
                    <span class="status-badge ${rule.status === 'active' ? 'status-active' : 'status-inactive'}">
                        ${rule.status === 'active' ? '启用' : '禁用'}
                    </span>
                </div>
            </div>
            <div class="rule-details">
                <div class="detail-item">
                    <span class="label">适用地区:</span>
                    <span class="value">${getRegionName(rule.region)}</span>
                </div>
                <div class="detail-item">
                    <span class="label">计费方式:</span>
                    <span class="value">${getTypeName(rule.type)}</span>
                </div>
                <div class="detail-item">
                    <span class="label">重量范围:</span>
                    <span class="value">${rule.minWeight}kg - ${rule.maxWeight === 999 ? '∞' : rule.maxWeight + 'kg'}</span>
                </div>
                <div class="detail-item">
                    <span class="label">运费:</span>
                    <span class="value fee">¥${rule.fee.toFixed(2)}</span>
                </div>
                <div class="detail-item">
                    <span class="label">创建时间:</span>
                    <span class="value">${rule.createTime}</span>
                </div>
            </div>
            <div class="rule-actions">
                <button class="btn btn-sm btn-primary" onclick="editRule('${rule.id}')">编辑</button>
                <button class="btn btn-sm btn-secondary" onclick="toggleRuleStatus('${rule.id}')">
                    ${rule.status === 'active' ? '禁用' : '启用'}
                </button>
                <button class="btn btn-sm btn-danger" onclick="deleteRule('${rule.id}')">删除</button>
            </div>
        </div>
    `).join('');
}

// 打开新增规则模态框
function openAddRuleModal() {
    const modal = document.getElementById('add-rule-modal');
    if (modal) {
        modal.style.display = 'flex';
        document.body.style.overflow = 'hidden';
    }
}

// 关闭新增规则模态框
function closeAddRuleModal() {
    const modal = document.getElementById('add-rule-modal');
    if (modal) {
        modal.style.display = 'none';
        document.body.style.overflow = 'auto';
        // 清空表单
        document.getElementById('add-rule-form').reset();
    }
}

// 提交新增规则
function submitAddRule() {
    const form = document.getElementById('add-rule-form');
    if (!form) return;
    
    const formData = new FormData(form);
    const newRule = {
        id: 'R' + Date.now(),
        name: formData.get('ruleName'),
        region: formData.get('region'),
        type: formData.get('type'),
        minWeight: parseFloat(formData.get('minWeight')) || 0,
        maxWeight: parseFloat(formData.get('maxWeight')) || 999,
        fee: parseFloat(formData.get('fee')),
        status: formData.get('status'),
        createTime: new Date().toLocaleString('zh-CN')
    };
    
    // 验证必填字段
    if (!newRule.name || !newRule.region || !newRule.type || newRule.fee === null) {
        alert('请填写所有必填字段！');
        return;
    }
    
    shippingRules.push(newRule);
    loadShippingRules();
    closeAddRuleModal();
    alert('运费规则添加成功！');
}

// 编辑规则
function editRule(ruleId) {
    const rule = shippingRules.find(r => r.id === ruleId);
    if (!rule) return;
    
    // 填充表单数据
    document.getElementById('rule-name').value = rule.name;
    document.getElementById('rule-region').value = rule.region;
    document.getElementById('rule-type').value = rule.type;
    document.getElementById('rule-min-weight').value = rule.minWeight;
    document.getElementById('rule-max-weight').value = rule.maxWeight;
    document.getElementById('rule-fee').value = rule.fee;
    document.getElementById('rule-status').value = rule.status;
    
    openAddRuleModal();
}

// 切换规则状态
function toggleRuleStatus(ruleId) {
    const rule = shippingRules.find(r => r.id === ruleId);
    if (!rule) return;
    
    rule.status = rule.status === 'active' ? 'inactive' : 'active';
    loadShippingRules();
    alert(`规则已${rule.status === 'active' ? '启用' : '禁用'}！`);
}

// 删除规则
function deleteRule(ruleId) {
    if (!confirm('确定要删除这个运费规则吗？删除后无法恢复！')) return;
    
    const index = shippingRules.findIndex(r => r.id === ruleId);
    if (index > -1) {
        shippingRules.splice(index, 1);
        loadShippingRules();
        alert('运费规则已删除！');
    }
}

// 批量编辑规则
function batchEditRules() {
    alert('批量编辑功能开发中...');
}

// 编辑地区运费
function editRegionShipping(region) {
    const modal = document.getElementById('edit-region-modal');
    const title = document.getElementById('edit-region-title');
    const editor = document.getElementById('region-rules-editor');
    
    if (!modal || !title || !editor) return;
    
    title.textContent = `编辑${regionShippingConfig[region].name}运费`;
    
    editor.innerHTML = regionShippingConfig[region].rules.map((rule, index) => `
        <div class="rule-editor-item">
            <div class="rule-editor-header">
                <h4>规则 ${index + 1}</h4>
                <button class="btn btn-sm btn-danger" onclick="removeRegionRule('${region}', ${index})">删除</button>
            </div>
            <div class="rule-editor-form">
                <div class="form-group">
                    <label>最小重量 (kg)</label>
                    <input type="number" class="form-input" value="${rule.minWeight}" step="0.01" min="0" 
                           onchange="updateRegionRule('${region}', ${index}, 'minWeight', this.value)">
                </div>
                <div class="form-group">
                    <label>最大重量 (kg)</label>
                    <input type="number" class="form-input" value="${rule.maxWeight}" step="0.01" min="0" 
                           onchange="updateRegionRule('${region}', ${index}, 'maxWeight', this.value)">
                </div>
                <div class="form-group">
                    <label>运费 (元)</label>
                    <input type="number" class="form-input" value="${rule.fee}" step="0.01" min="0" 
                           onchange="updateRegionRule('${region}', ${index}, 'fee', this.value)">
                </div>
            </div>
        </div>
    `).join('');
    
    modal.style.display = 'flex';
    document.body.style.overflow = 'hidden';
}

// 更新地区规则
function updateRegionRule(region, index, field, value) {
    if (regionShippingConfig[region] && regionShippingConfig[region].rules[index]) {
        regionShippingConfig[region].rules[index][field] = parseFloat(value) || 0;
    }
}

// 删除地区规则
function removeRegionRule(region, index) {
    if (regionShippingConfig[region] && regionShippingConfig[region].rules.length > 1) {
        regionShippingConfig[region].rules.splice(index, 1);
        editRegionShipping(region); // 重新渲染
    } else {
        alert('至少需要保留一个运费规则！');
    }
}

// 关闭编辑地区模态框
function closeEditRegionModal() {
    const modal = document.getElementById('edit-region-modal');
    if (modal) {
        modal.style.display = 'none';
        document.body.style.overflow = 'auto';
    }
}

// 保存地区规则
function saveRegionRules() {
    // 这里可以保存到后端或本地存储
    alert('地区运费规则已保存！');
    closeEditRegionModal();
    // 重新渲染地区运费显示
    renderRegionShipping();
}

// 重新渲染地区运费显示
function renderRegionShipping() {
    // 这里可以重新渲染页面上的地区运费显示
    console.log('地区运费规则已更新');
}

// 初始化运费计算器
function initShippingCalculator() {
    // 计算器功能已通过HTML中的onclick绑定
}

// 计算运费
function calculateShipping() {
    const region = document.getElementById('calc-region').value;
    const weight = parseFloat(document.getElementById('calc-weight').value) || 0;
    const quantity = parseInt(document.getElementById('calc-quantity').value) || 1;
    const orderAmount = parseFloat(document.getElementById('calc-amount').value) || 0;
    const resultDiv = document.getElementById('calculator-result');
    
    if (!resultDiv) return;
    
    if (weight <= 0) {
        resultDiv.innerHTML = '<div class="result-placeholder">请输入有效的重量</div>';
        return;
    }
    
    const totalWeight = weight * quantity;
    const shippingFee = calculateShippingFee(region, totalWeight, '', '', orderAmount);
    
    resultDiv.innerHTML = `
        <div class="calculation-result">
            <div class="result-header">
                <h4>运费计算结果</h4>
            </div>
            <div class="result-details">
                <div class="detail-row">
                    <span class="label">配送地区:</span>
                    <span class="value">${getRegionName(region)}</span>
                </div>
                <div class="detail-row">
                    <span class="label">单件重量:</span>
                    <span class="value">${weight.toFixed(2)}kg</span>
                </div>
                <div class="detail-row">
                    <span class="label">商品数量:</span>
                    <span class="value">${quantity}件</span>
                </div>
                <div class="detail-row">
                    <span class="label">总重量:</span>
                    <span class="value">${totalWeight.toFixed(2)}kg</span>
                </div>
                <div class="detail-row">
                    <span class="label">订单金额:</span>
                    <span class="value">$${orderAmount.toFixed(2)}</span>
                </div>
                <div class="detail-row total">
                    <span class="label">运费总计:</span>
                    <span class="value fee">$${shippingFee.toFixed(2)}</span>
                </div>
            </div>
        </div>
    `;
}

// 根据地区和重量计算运费
function calculateShippingFee(region, totalWeight, productBrand = '', deliveryRegion = '', orderAmount = 0) {
    const config = regionShippingConfig[region];
    if (!config) return 0;
    
    let baseFee = 0;
    
    // 中国大陆标准运费
    if (region === 'mainland') {
        // 最低1公斤，不足1公斤按1公斤计算
        const calculatedWeight = Math.max(1, Math.ceil(totalWeight));
        baseFee = calculatedWeight * config.ratePerKg;
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
    if (region === 'remote' && config.regions.includes(deliveryRegion)) {
        baseFee = config.extraFee;
    }
    
    // Taopu品牌奶粉额外运费
    if (region === 'taopu' && productBrand.toLowerCase().includes('taopu') && config.regions.includes(deliveryRegion)) {
        baseFee = config.extraFee;
    }
    
    return baseFee;
}

// 导出函数供HTML使用
window.openAddRuleModal = openAddRuleModal;
window.closeAddRuleModal = closeAddRuleModal;
window.submitAddRule = submitAddRule;
window.editRule = editRule;
window.toggleRuleStatus = toggleRuleStatus;
window.deleteRule = deleteRule;
window.batchEditRules = batchEditRules;
window.editRegionShipping = editRegionShipping;
window.closeEditRegionModal = closeEditRegionModal;
window.saveRegionRules = saveRegionRules;
window.calculateShipping = calculateShipping;
window.updateRegionRule = updateRegionRule;
window.removeRegionRule = removeRegionRule;
