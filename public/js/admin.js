// ==========================================
// 1. GESTÃO DE PRODUTOS E VARIAÇÕES
// ==========================================

function adicionarLinhaVariacao() {
    const container = document.getElementById('container-variacoes');
    const div = document.createElement('div');
    div.className = 'variacao-row';
    
    div.innerHTML = `
        <input type="text" class="input-marca" placeholder="Opção (Ex: P, M, G)" required>
        <input type="number" class="input-custo" placeholder="Custo" step="0.01">
        <input type="number" class="input-venda" placeholder="Venda" step="0.01" required>
        <input type="number" class="input-estoque" placeholder="Qtd" value="10">
        <button type="button" class="btn-remove" onclick="this.parentElement.remove()">X</button>
    `;
    container.appendChild(div);
}

document.getElementById('form-produto').addEventListener('submit', async (e) => {
    e.preventDefault();
    const form = e.target;
    const formData = new FormData();

    formData.append('nome', form.nome.value);
    formData.append('categoria', form.categoria.value);
    formData.append('imagem', form.imagem.files[0]);

    const variacoes = [];
    document.querySelectorAll('.variacao-row').forEach(linha => {
        variacoes.push({
            marca: linha.querySelector('.input-marca').value,
            preco_custo: parseFloat(linha.querySelector('.input-custo').value) || 0,
            preco_venda: parseFloat(linha.querySelector('.input-venda').value) || 0,
            estoque: parseInt(linha.querySelector('.input-estoque').value) || 0
        });
    });

    formData.append('variacoes', JSON.stringify(variacoes));

    try {
        const res = await fetch('/api/produtos', { method: 'POST', body: formData });
        if (res.ok) {
            alert("✅ Produto salvo na base!");
            form.reset();
            document.getElementById('container-variacoes').innerHTML = '';
            adicionarLinhaVariacao();
            carregarListaAdmin();
        } else {
            alert("Erro ao salvar.");
        }
    } catch (error) { console.error(error); }
});

async function carregarListaAdmin() {
    const container = document.getElementById('lista-produtos-admin');
    container.innerHTML = '<p style="color:#888">Carregando inventário...</p>';

    try {
        const res = await fetch('/api/produtos');
        const produtos = await res.json();
        container.innerHTML = '';

        produtos.forEach(p => {
            let htmlVars = '<div style="margin-top:10px; font-size:13px; color:#aaa;">';
            if(p.variacoes){
                p.variacoes.forEach((v, idx) => {
                    htmlVars += `
                        <div style="display:flex; justify-content:space-between; border-bottom:1px solid #333; padding:4px 0;">
                            <span>${v.marca} (Est: <b style="color:#fff">${v.estoque}</b>) - R$ ${v.preco_venda}</span>
                            <span style="cursor:pointer; color:#ff4444;" onclick="deletarVariacao(${p.id}, ${idx})">[x]</span>
                        </div>`;
                });
            }
            htmlVars += '</div>';

            const item = document.createElement('div');
            item.className = 'card-item'; // Usa a classe do CSS Dark
            item.innerHTML = `
                <div style="width:100%">
                    <div style="display:flex; justify-content:space-between; align-items:center;">
                        <div style="display:flex; align-items:center; gap:15px;">
                            <img src="${p.imagem || ''}" style="width:50px; height:50px; object-fit:cover; border-radius:8px; border:1px solid #444;">
                            <div><strong style="color:#fff; font-size:1.1em;">${p.nome}</strong><br><small style="color:#888">${p.categoria}</small></div>
                        </div>
                        <button onclick="deletarProduto(${p.id})" style="background:transparent; color:#ff4444; border:1px solid #ff4444; padding:5px 10px; border-radius:5px;">Excluir</button>
                    </div>
                    ${htmlVars}
                </div>
            `;
            container.appendChild(item);
        });
    } catch (e) { console.error(e); }
}

async function deletarVariacao(idProd, index) {
    if(confirm("Remover esta variação?")) {
        await fetch(`/api/produtos/${idProd}/variacao/${index}`, { method: 'DELETE' });
        carregarListaAdmin();
    }
}

async function deletarProduto(id) {
    if(confirm("Tem certeza que deseja excluir o produto inteiro?")) {
        await fetch(`/api/produtos/${id}`, { method: 'DELETE' });
        carregarListaAdmin();
    }
}

// ==========================================
// 2. GESTÃO DE CUPONS
// ==========================================

async function carregarCupons() {
    const container = document.getElementById('lista-cupons');
    if(!container) return;
    
    try {
        const res = await fetch('/api/cupons');
        const cupons = await res.json();
        container.innerHTML = '';

        cupons.forEach(c => {
            container.innerHTML += `
                <div class="card-item" style="padding:15px; margin-bottom:10px; display:flex; justify-content:space-between; align-items:center;">
                    <span style="color:#fff;">🎟️ <b style="color:#9d00ff">${c.codigo}</b> - <span style="color:#00ff88">${c.desconto}% OFF</span></span>
                    <button onclick="deletarCupom('${c.codigo}')" style="background:none; border:none; color:#ff4444; cursor:pointer; font-size:1.2em;">🗑️</button>
                </div>`;
        });
    } catch (e) { console.error(e); }
}

const formCupom = document.getElementById('form-cupom');
if(formCupom) {
    formCupom.addEventListener('submit', async (e) => {
        e.preventDefault();
        const codigo = document.getElementById('codigo-cupom').value;
        const desconto = document.getElementById('valor-cupom').value;

        await fetch('/api/cupons', {
            method: 'POST',
            headers: {'Content-Type': 'application/json'},
            body: JSON.stringify({ codigo, desconto })
        });
        alert("Cupom criado!");
        e.target.reset();
        carregarCupons();
    });
}

async function deletarCupom(cod) {
    if(confirm("Apagar cupom?")) {
        await fetch(`/api/cupons/${cod}`, { method: 'DELETE' });
        carregarCupons();
    }
}

// ==========================================
// 3. GESTÃO DE PEDIDOS (CORRIGIDO DARK MODE)
// ==========================================

async function carregarVendas() {
    const container = document.getElementById('lista-vendas');
    if(!container) return;
    
    container.innerHTML = '<p style="color:#888">Buscando pedidos...</p>';
    try {
        const res = await fetch('/api/vendas');
        const vendas = await res.json();
        container.innerHTML = '';

        if(vendas.length === 0) {
            container.innerHTML = '<p style="color:#666">Nenhuma venda registrada.</p>';
            return;
        }

        vendas.forEach(v => {
            // Lógica de cores baseada no status
            const isPendente = v.status === 'Pendente';
            const statusColor = isPendente ? '#ffaa00' : '#00ff88'; // Laranja ou Verde Neon
            const borderStyle = `border-left: 4px solid ${statusColor};`;
            
            const btnAcao = isPendente 
                ? `<button onclick="confirmarVenda(${v.id_pedido})" style="background: rgba(0,255,136,0.1); color:#00ff88; border:1px solid #00ff88; padding:8px 15px; border-radius:5px; cursor:pointer; font-weight:bold; text-transform:uppercase;">✅ Aprovar & Baixar</button>`
                : `<span style="color:#00ff88; font-weight:bold; border:1px solid #00ff88; padding:5px 10px; border-radius:5px;">✔ CONCLUÍDO</span>`;

            let itensHtml = v.itens.map(i => `<li style="margin-bottom:5px;">${i.qtd}x <span style="color:#fff">${i.produto}</span> <span style="color:#888">(${i.marca})</span></li>`).join('');

            const div = document.createElement('div');
            div.className = 'card-item'; // Classe do CSS Dark
            div.style = borderStyle + " padding: 20px; margin-bottom: 15px;"; // Ajustes finos

            div.innerHTML = `
                <div style="display:flex; justify-content:space-between; align-items:flex-start; flex-wrap:wrap; gap:20px;">
                    <div>
                        <div style="font-size:1.1em; color:#fff; margin-bottom:5px;"><strong>PEDIDO #${v.id_pedido}</strong></div>
                        <small style="color:#888;">📅 ${v.data}</small>
                        <ul style="margin:15px 0; padding-left:20px; color:#ccc;">${itensHtml}</ul>
                        <div style="font-size:1.2em; color:#ffd700;">TOTAL: <b>R$ ${parseFloat(v.total).toFixed(2)}</b></div>
                    </div>
                    <div style="text-align:right;">
                        <div style="margin-bottom:10px; font-weight:bold; color:${statusColor}; letter-spacing:1px;">${v.status.toUpperCase()}</div>
                        ${btnAcao}
                    </div>
                </div>`;
            
            container.appendChild(div);
        });
    } catch (e) { console.error(e); }
}

async function confirmarVenda(id) {
    if(!confirm("Confirmar pagamento e dar baixa no estoque?")) return;

    try {
        const res = await fetch(`/api/venda/${id}/confirmar`, { method: 'POST' });
        const data = await res.json();
        
        if(res.ok) {
            // alert("Sucesso! Estoque atualizado."); // Opcional: removemos o alert chato
            carregarVendas(); // Atualiza lista de vendas
            carregarListaAdmin(); // Atualiza lista de produtos (para ver estoque novo)
        } else {
            alert("Erro: " + data.message);
        }
    } catch (e) { alert("Erro de conexão"); }
}

// INICIALIZAÇÃO
adicionarLinhaVariacao();
carregarListaAdmin();
carregarCupons();
carregarVendas();