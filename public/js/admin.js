// ==========================================
// 1. GESTÃO DE PRODUTOS (CRIAR E EDITAR)
// ==========================================

/* --- FUNÇÃO PARA ADICIONAR VARIAÇÃO (MOBILE FRIENDLY) --- */
function adicionarLinhaVariacao(dados = {}) {
    const container = document.getElementById('container-variacoes');
    const div = document.createElement('div');
    div.className = 'variacao-row'; 

    div.innerHTML = `
        <div class="form-group" style="margin-bottom:5px;">
            <input type="text" placeholder="Opção (Ex: G, 42, Azul)" class="var-marca" value="${dados.marca || ''}" required>
        </div>
        
        <div style="display:flex; gap:10px;">
            <div style="flex:1;">
                <input type="number" placeholder="Preço R$" class="var-preco" value="${dados.preco_venda || ''}" step="0.01" required>
            </div>
            <div style="flex:1;">
                <input type="number" placeholder="Qtd" class="var-estoque" value="${dados.estoque || ''}" required>
            </div>
        </div>

        <button type="button" class="btn-remove" onclick="this.parentElement.remove()">
            <i class="fas fa-trash"></i> REMOVER
        </button>
    `;

    container.appendChild(div);
}

// Prepara o formulário para EDIÇÃO
function iniciarEdicao(produto) {
    // 1. Preenche os campos básicos
    document.getElementById('id-produto-editando').value = produto.id;
    document.querySelector('input[name="nome"]').value = produto.nome;
    document.querySelector('input[name="categoria"]').value = produto.categoria;
    
    // 2. Limpa e recria as variações
    document.getElementById('container-variacoes').innerHTML = '';
    if (produto.variacoes && produto.variacoes.length > 0) {
        produto.variacoes.forEach(v => adicionarLinhaVariacao(v));
    } else {
        adicionarLinhaVariacao();
    }

    // 3. Muda o visual dos botões
    document.getElementById('btn-submit').innerText = "🔄 ATUALIZAR PRODUTO";
    document.getElementById('btn-submit').style.background = "linear-gradient(45deg, #9d00ff, #7a00cc)"; 
    document.getElementById('btn-cancelar').style.display = 'block';
    
    // 4. Leva a tela para o topo
    window.scrollTo({ top: 0, behavior: 'smooth' });
}

function cancelarEdicao() {
    document.getElementById('form-produto').reset();
    document.getElementById('id-produto-editando').value = '';
    document.getElementById('container-variacoes').innerHTML = '';
    adicionarLinhaVariacao(); 
    
    // Reseta botões
    document.getElementById('btn-submit').innerText = "💾 SALVAR NO ESTOQUE";
    document.getElementById('btn-submit').style.background = ""; 
    document.getElementById('btn-cancelar').style.display = 'none';
}

// ENVIO DO FORMULÁRIO (CRIAR OU ATUALIZAR)
document.getElementById('form-produto').addEventListener('submit', async (e) => {
    e.preventDefault();
    const form = e.target;
    const formData = new FormData();
    const idEdicao = document.getElementById('id-produto-editando').value;

    formData.append('nome', form.nome.value);
    formData.append('categoria', form.categoria.value);
    if(form.imagem.files[0]) {
        formData.append('imagem', form.imagem.files[0]);
    }

    const variacoes = [];
    document.querySelectorAll('.variacao-row').forEach(linha => {
        variacoes.push({
            marca: linha.querySelector('.var-marca').value,
            preco_venda: parseFloat(linha.querySelector('.var-preco').value) || 0,
            estoque: parseInt(linha.querySelector('.var-estoque').value) || 0
        });
    });

    formData.append('variacoes', JSON.stringify(variacoes));

    try {
        let url = '/api/produtos';
        let method = 'POST';

        // Se tiver ID, é edição (PUT)
        if(idEdicao) {
            url = `/api/produtos/${idEdicao}`;
            method = 'PUT';
        }

        const res = await fetch(url, { method: method, body: formData });
        
        if (res.ok) {
            alert(idEdicao ? "✅ Produto atualizado!" : "✅ Produto criado!");
            cancelarEdicao(); // Limpa tudo
            carregarListaAdmin();
        } else {
            alert("Erro ao salvar.");
        }
    } catch (error) { console.error(error); }
});

// LISTAGEM DE PRODUTOS
async function carregarListaAdmin() {
    const container = document.getElementById('lista-produtos-admin');
    if(!container) return; // Proteção caso elemento não exista
    container.innerHTML = '<p style="color:#888">Carregando inventário...</p>';

    try {
        const res = await fetch('/api/produtos');
        const produtos = await res.json();
        container.innerHTML = '';

        // Guardamos a lista globalmente para poder usar na edição
        window.todosProdutos = produtos; 

        produtos.forEach(p => {
            let htmlVars = '<div style="margin-top:10px; font-size:13px; color:#aaa;">';
            if(p.variacoes){
                p.variacoes.forEach((v) => {
                    htmlVars += `
                        <div style="display:flex; justify-content:space-between; border-bottom:1px solid #333; padding:4px 0;">
                            <span>${v.marca} (Est: <b style="color:#fff">${v.estoque}</b>) - R$ ${v.preco_venda}</span>
                        </div>`;
                });
            }
            htmlVars += '</div>';

            const item = document.createElement('div');
            item.className = 'card-item';
            item.innerHTML = `
                <div style="width:100%">
                    <div style="display:flex; justify-content:space-between; align-items:center;">
                        <div style="display:flex; align-items:center; gap:15px;">
                            <img src="${p.imagem || ''}" style="width:50px; height:50px; object-fit:cover; border-radius:8px; border:1px solid #444;">
                            <div><strong style="color:#fff; font-size:1.1em;">${p.nome}</strong><br><small style="color:#888">${p.categoria}</small></div>
                        </div>
                        <div style="display:flex; gap:10px;">
                            <button onclick='prepararEdicao(${p.id})' style="background:transparent; color:#ffd700; border:1px solid #ffd700; padding:5px 10px; border-radius:5px;">✏️</button>
                            <button onclick="deletarProduto(${p.id})" style="background:transparent; color:#ff4444; border:1px solid #ff4444; padding:5px 10px; border-radius:5px;">🗑️</button>
                        </div>
                    </div>
                    ${htmlVars}
                </div>
            `;
            container.appendChild(item);
        });
    } catch (e) { console.error(e); }
}

function prepararEdicao(id) {
    const produto = window.todosProdutos.find(p => p.id === id);
    if(produto) {
        iniciarEdicao(produto);
        mostrarAba('produtos'); // Garante que a aba certa está aberta
    }
}

async function deletarProduto(id) {
    if(confirm("Tem certeza que deseja excluir?")) {
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
        await fetch('/api/cupons', { method: 'POST', headers: {'Content-Type': 'application/json'}, body: JSON.stringify({ codigo, desconto }) });
        alert("Cupom criado!");
        e.target.reset();
        carregarCupons();
    });
}
async function deletarCupom(cod) {
    if(confirm("Apagar cupom?")) { await fetch(`/api/cupons/${cod}`, { method: 'DELETE' }); carregarCupons(); }
}

// ==========================================
// 3. GESTÃO DE PEDIDOS
// ==========================================
async function carregarVendas() {
    const container = document.getElementById('lista-vendas');
    if(!container) return;
    container.innerHTML = '<p style="color:#888">Buscando pedidos...</p>';
    try {
        const res = await fetch('/api/vendas');
        const vendas = await res.json();
        container.innerHTML = '';
        if(vendas.length === 0) { container.innerHTML = '<p style="color:#666">Nenhuma venda registrada.</p>'; return; }
        vendas.forEach(v => {
            const isPendente = v.status === 'Pendente';
            const statusColor = isPendente ? '#ffaa00' : '#00ff88';
            const btnAcao = isPendente 
                ? `<button onclick="confirmarVenda(${v.id_pedido})" style="background: rgba(0,255,136,0.1); color:#00ff88; border:1px solid #00ff88; padding:8px 15px; border-radius:5px; cursor:pointer; font-weight:bold;">✅ Aprovar & Baixar</button>`
                : `<span style="color:#00ff88; font-weight:bold; border:1px solid #00ff88; padding:5px 10px; border-radius:5px;">✔ CONCLUÍDO</span>`;
            let itensHtml = v.itens.map(i => `<li style="margin-bottom:5px;">${i.qtd}x <span style="color:#fff">${i.produto}</span> <span style="color:#888">(${i.marca})</span></li>`).join('');
            container.innerHTML += `
                <div class="card-item" style="border-left: 4px solid ${statusColor}; padding: 20px; margin-bottom: 15px;">
                    <div style="display:flex; justify-content:space-between; align-items:flex-start; flex-wrap:wrap; gap:20px;">
                        <div>
                            <div style="font-size:1.1em; color:#fff; margin-bottom:5px;"><strong>PEDIDO #${v.id_pedido}</strong></div>
                            <small style="color:#888;">📅 ${v.data}</small>
                            <ul style="margin:15px 0; padding-left:20px; color:#ccc;">${itensHtml}</ul>
                            <div style="font-size:1.2em; color:#ffd700;">TOTAL: <b>R$ ${parseFloat(v.total).toFixed(2)}</b></div>
                        </div>
                        <div style="text-align:right;">
                            <div style="margin-bottom:10px; font-weight:bold; color:${statusColor};">${v.status.toUpperCase()}</div>
                            ${btnAcao}
                        </div>
                    </div>
                </div>`;
        });
    } catch (e) { console.error(e); }
}
async function confirmarVenda(id) {
    if(!confirm("Confirmar baixa?")) return;
    try {
        const res = await fetch(`/api/venda/${id}/confirmar`, { method: 'POST' });
        const data = await res.json();
        if(res.ok) { carregarVendas(); carregarListaAdmin(); } 
        else { alert("Erro: " + data.message); }
    } catch (e) { alert("Erro de conexão"); }
}

// ==========================================
// 4. GESTÃO DE ABAS E CONFIGURAÇÕES
// ==========================================

/* --- LÓGICA DE ABAS --- */
function mostrarAba(aba) {
    // Esconde tudo
    document.getElementById('aba-produtos').style.display = 'none';
    document.getElementById('aba-config').style.display = 'none';
    document.getElementById('aba-social').style.display = 'none';
    
    // Remove classe ativo
    document.querySelectorAll('.btn-nav').forEach(b => b.classList.remove('ativo'));

    // Lógica para mostrar a certa e carregar dados se necessário
    if (aba === 'produtos') {
        document.getElementById('aba-produtos').style.display = 'block';
        if(document.getElementById('nav-produtos')) document.getElementById('nav-produtos').classList.add('ativo');
    } 
    else if (aba === 'config') {
        document.getElementById('aba-config').style.display = 'block';
        if(document.getElementById('nav-config')) document.getElementById('nav-config').classList.add('ativo');
        carregarConfiguracoesNoForm();
    }
    else if (aba === 'social') {
        document.getElementById('aba-social').style.display = 'block';
        if(document.getElementById('nav-social')) document.getElementById('nav-social').classList.add('ativo');
        carregarConfiguracoesNoForm();
    }
}

/* --- CARREGAR DADOS (CORRIGIDO: usa /api/config) --- */
async function carregarConfiguracoesNoForm() {
    try {
        const res = await fetch('/api/config'); // CORREÇÃO: Rota atualizada
        const config = await res.json();

        // Campos Visuais
        if (document.getElementById('config-nome')) {
            if (config.nomeLoja) document.getElementById('config-nome').value = config.nomeLoja;
            if (config.corDestaque) document.getElementById('config-cor').value = config.corDestaque;
        }

        // Campos Sociais (CORREÇÃO: whatsapp vs whatsappPedidos)
        if (document.getElementById('social-zap-pedidos')) {
            // Verifica 'whatsapp' que é o padrão novo, ou 'whatsappPedidos' legado
            if (config.whatsapp) {
                document.getElementById('social-zap-pedidos').value = config.whatsapp;
            } else if (config.whatsappPedidos) {
                document.getElementById('social-zap-pedidos').value = config.whatsappPedidos;
            }

            if (config.whatsappFlutuante) document.getElementById('social-zap-float').value = config.whatsappFlutuante;
            if (config.instagramLink) document.getElementById('social-insta').value = config.instagramLink;
        }
        
    } catch (error) {
        console.error("Erro ao ler config:", error);
    }
}

/* --- FUNÇÃO GENÉRICA DE SALVAR CONFIG (CORRIGIDO: usa /api/config) --- */
async function salvarConfigGeneric(e) {
    e.preventDefault();
    const btn = e.target.querySelector('button');
    const originalText = btn.innerText;
    btn.innerText = "Salvando...";
    btn.disabled = true;

    const formData = new FormData(e.target);

    try {
        // CORREÇÃO: Rota atualizada para /api/config
        await fetch('/api/config', { method: 'POST', body: formData });
        alert("✅ Configurações salvas com sucesso!");
    } catch (error) {
        alert("Erro ao salvar.");
        console.error(error);
    } finally {
        btn.innerText = originalText;
        btn.disabled = false;
    }
}

// Listeners de Configuração
const formTema = document.getElementById('form-tema');
if (formTema) formTema.addEventListener('submit', salvarConfigGeneric);

const formSocial = document.getElementById('form-social');
if (formSocial) formSocial.addEventListener('submit', salvarConfigGeneric);


function sair() {
    // Opcional: Chamar rota de logout no back
    window.location.href = '/login.html'; 
}

// INICIALIZAÇÃO AO CARREGAR PÁGINA
document.addEventListener('DOMContentLoaded', () => {
    adicionarLinhaVariacao();
    carregarListaAdmin();
    carregarCupons();
    carregarVendas();
    // Carrega dados iniciais para não vir vazio
    carregarConfiguracoesNoForm();
});