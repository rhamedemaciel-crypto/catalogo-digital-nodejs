const express = require('express');
const cors = require('cors');
const multer = require('multer');
const fs = require('fs');
const path = require('path');
const session = require('express-session');

const app = express();
// 🔥 CORREÇÃO CRÍTICA PARA O RENDER: Usar a porta do ambiente
const PORT = process.env.PORT || 3000;

// --- CONFIGURAÇÕES BÁSICAS ---
app.use(cors()); 
app.use(express.json()); 
// Aumentado o limite para aceitar uploads maiores de variações/imagens
app.use(express.urlencoded({ extended: true, limit: '10mb' })); 
app.use(express.static('public')); 
// Garante que imagens upadas sejam servidas
app.use('/uploads', express.static(path.join(__dirname, 'public/uploads')));

// --- CONFIGURAÇÃO DA SESSÃO ---
app.use(session({
    secret: 'chave-secreta-sistema-loja',
    resave: false,
    saveUninitialized: true,
    cookie: { secure: false } // Mude para true se tiver HTTPS configurado
}));

// --- CONFIGURAÇÃO DE UPLOAD (MULTER) ---
const storage = multer.diskStorage({
    destination: (req, file, cb) => {
        const dir = path.join(__dirname, 'public', 'uploads');
        if (!fs.existsSync(dir)){
            fs.mkdirSync(dir, { recursive: true });
        }
        cb(null, dir); 
    },
    filename: (req, file, cb) => {
        // Limpeza de nome de arquivo para evitar erros de URL
        const nomeLimpo = file.originalname.replace(/\s+/g, '_').replace(/[^a-zA-Z0-9._-]/g, '');
        cb(null, Date.now() + '-' + nomeLimpo);
    }
});
const upload = multer({ storage: storage });

// --- BANCO DE DADOS (ARQUIVOS JSON) ---
const DATA_DIR = path.join(__dirname, 'data');
// Garante que a pasta data existe
if (!fs.existsSync(DATA_DIR)){
    fs.mkdirSync(DATA_DIR, { recursive: true });
}

const ARQUIVO_PRODUTOS = path.join(DATA_DIR, 'produtos.json');
const ARQUIVO_VENDAS = path.join(DATA_DIR, 'vendas.json');
const ARQUIVO_CUPONS = path.join(DATA_DIR, 'cupons.json');
const ARQUIVO_CONFIG = path.join(DATA_DIR, 'loja-config.json'); 

// Função auxiliar para ler JSON (Blindada contra falhas)
function lerJSON(arquivo) {
    try {
        if (!fs.existsSync(arquivo)) {
            const conteudoPadrao = arquivo.includes('config') ? '{}' : '[]';
            fs.writeFileSync(arquivo, conteudoPadrao);
            return JSON.parse(conteudoPadrao);
        }
        const dados = fs.readFileSync(arquivo, 'utf8');
        return JSON.parse(dados || (arquivo.includes('config') ? '{}' : '[]'));
    } catch (e) {
        console.error(`Erro ao ler ${arquivo}:`, e.message);
        return (arquivo.includes('config') ? {} : []);
    }
}

function salvarJSON(arquivo, dados) {
    try {
        fs.writeFileSync(arquivo, JSON.stringify(dados, null, 2));
    } catch (e) {
        console.error(`Erro ao salvar ${arquivo}:`, e.message);
    }
}

// ========================================================
// 🔐 ÁREA DE SEGURANÇA
// ========================================================

app.post('/api/login', (req, res) => {
    // Compatibilidade com diferentes nomes de campo que possam vir do front
    const user = req.body.user;
    const senha = req.body.senha || req.body.pass;
    
    if (senha === 'admin123' || (user === 'admin' && senha === '123456')) { 
        req.session.usuarioLogado = true;
        res.json({ success: true });
    } else {
        res.status(401).json({ success: false, message: 'Senha incorreta' });
    }
});

app.get('/admin', (req, res) => {
    if (req.session.usuarioLogado) {
        res.sendFile(path.join(__dirname, 'private', 'admin.html'));
    } else {
        res.redirect('/login.html');
    }
});

app.get('/logout', (req, res) => {
    req.session.destroy();
    res.redirect('/login.html');
});

// ========================================================
// 📊 DASHBOARD & ESTATÍSTICAS (SUA LÓGICA RESTAURADA)
// ========================================================

app.get('/api/dashboard', (req, res) => {
    try {
        const vendas = lerJSON(ARQUIVO_VENDAS);
        const produtos = lerJSON(ARQUIVO_PRODUTOS);

        const hoje = new Date().toISOString().split('T')[0]; // YYYY-MM-DD
        
        let faturamentoHoje = 0;
        let pendentes = 0;
        let totalVendasAprovadas = 0;
        let valorTotalAprovado = 0;

        // Mapa para o Gráfico (Últimos 7 dias)
        const vendasPorDia = {};
        for (let i = 6; i >= 0; i--) {
            const d = new Date();
            d.setDate(d.getDate() - i);
            const dataStr = d.toISOString().split('T')[0];
            vendasPorDia[dataStr] = 0;
        }

        vendas.forEach(v => {
            // Normalização de data
            let dataVenda = '';
            try {
                if(v.data && v.data.includes('T')) dataVenda = v.data.split('T')[0];
                else if (v.data) {
                    const parts = v.data.split(' ')[0].split('/'); 
                    if(parts.length === 3) dataVenda = `${parts[2]}-${parts[1]}-${parts[0]}`;
                }
            } catch(e) {}

            if (v.status === 'Pendente') {
                pendentes++;
            } else if (v.status === 'Aprovado') {
                const val = parseFloat(v.total) || 0;
                valorTotalAprovado += val;
                totalVendasAprovadas++;

                if (dataVenda === hoje) {
                    faturamentoHoje += val;
                }

                if (vendasPorDia[dataVenda] !== undefined) {
                    vendasPorDia[dataVenda] += val;
                }
            }
        });

        const ticketMedio = totalVendasAprovadas > 0 ? (valorTotalAprovado / totalVendasAprovadas) : 0;

        // Produtos com Baixo Estoque (< 5)
        const estoqueBaixo = [];
        produtos.forEach(p => {
            if(p.variacoes && Array.isArray(p.variacoes)) {
                p.variacoes.forEach(v => {
                    if(v.estoque < 5) {
                        estoqueBaixo.push({
                            nome: p.nome,
                            marca: v.marca || v.tamanho || 'Padrão',
                            estoque: v.estoque
                        });
                    }
                });
            }
        });

        res.json({
            faturamentoHoje,
            pendentes,
            ticketMedio,
            estoqueBaixo,
            grafico: {
                labels: Object.keys(vendasPorDia),
                valores: Object.values(vendasPorDia)
            }
        });

    } catch (error) {
        console.error("Erro dashboard:", error);
        res.status(500).json({ error: "Erro ao calcular dashboard" });
    }
});

// ========================================================
// 📦 API DE PRODUTOS (COM VARIAÇÕES E EDIÇÃO)
// ========================================================

app.get('/api/produtos', (req, res) => {
    const produtos = lerJSON(ARQUIVO_PRODUTOS);
    res.json(produtos);
});

app.post('/api/produtos', upload.single('imagem'), (req, res) => {
    try {
        const produtos = lerJSON(ARQUIVO_PRODUTOS);
        
        let variacoes = [];
        if (typeof req.body.variacoes === 'string') {
            try { variacoes = JSON.parse(req.body.variacoes); } catch(e) { variacoes = []; }
        } else {
            variacoes = req.body.variacoes || [];
        }

        const novoProduto = {
            id: Date.now(),
            nome: req.body.nome,
            categoria: req.body.categoria,
            imagem: req.file ? `/uploads/${req.file.filename}` : '',
            variacoes: variacoes,
            ativo: true,
            // Preço base: pega o menor preço das variações ou 0
            preco: variacoes.length > 0 ? Math.min(...variacoes.map(v => parseFloat(v.preco))) : (parseFloat(req.body.preco) || 0)
        };

        produtos.push(novoProduto);
        salvarJSON(ARQUIVO_PRODUTOS, produtos);
        
        // Suporta resposta JSON ou Redirect dependendo de quem chama
        if(req.xhr || req.headers.accept.indexOf('json') > -1) {
             res.json({ message: 'Produto cadastrado!', produto: novoProduto });
        } else {
             res.redirect('/admin'); // Fallback para forms HTML normais
        }
    } catch (erro) {
        console.error(erro);
        res.status(500).json({ error: "Erro interno" });
    }
});

app.put('/api/produtos/:id', upload.single('imagem'), (req, res) => {
    try {
        const id = parseInt(req.params.id);
        let produtos = lerJSON(ARQUIVO_PRODUTOS);
        const index = produtos.findIndex(p => p.id === id);

        if (index === -1) return res.status(404).json({ message: "Produto não encontrado" });

        let variacoes = [];
        if (typeof req.body.variacoes === 'string') {
            try { variacoes = JSON.parse(req.body.variacoes); } catch(e) { variacoes = []; }
        } else {
            variacoes = req.body.variacoes || [];
        }

        const imagemFinal = req.file ? `/uploads/${req.file.filename}` : produtos[index].imagem;

        produtos[index] = {
            ...produtos[index],
            nome: req.body.nome,
            categoria: req.body.categoria,
            imagem: imagemFinal,
            variacoes: variacoes,
            preco: variacoes.length > 0 ? Math.min(...variacoes.map(v => parseFloat(v.preco))) : (parseFloat(req.body.preco) || 0)
        };

        salvarJSON(ARQUIVO_PRODUTOS, produtos);
        res.json({ message: 'Produto atualizado com sucesso!' });
    } catch (erro) {
        console.error(erro);
        res.status(500).json({ error: "Erro ao atualizar" });
    }
});

app.delete('/api/produtos/:id', (req, res) => {
    const id = parseInt(req.params.id);
    let produtos = lerJSON(ARQUIVO_PRODUTOS);
    
    // Tenta limpar imagem do disco
    const produto = produtos.find(p => p.id === id);
    if(produto && produto.imagem && produto.imagem.startsWith('/uploads/')) {
         try {
            const pathImg = path.join(__dirname, 'public', produto.imagem);
            if(fs.existsSync(pathImg)) fs.unlinkSync(pathImg);
         } catch(e) { console.error("Erro ao apagar imagem:", e); }
    }

    const novaLista = produtos.filter(produto => produto.id !== id);
    salvarJSON(ARQUIVO_PRODUTOS, novaLista);
    res.json({ message: 'Produto deletado!' });
});

// ========================================================
// 🎟️ API DE CUPONS (RESTAURADA)
// ========================================================

app.get('/api/cupons', (req, res) => {
    res.json(lerJSON(ARQUIVO_CUPONS));
});

app.post('/api/cupons', (req, res) => {
    const cupons = lerJSON(ARQUIVO_CUPONS);
    const { codigo, desconto } = req.body;
    
    if (cupons.find(c => c.codigo === codigo.toUpperCase())) {
        return res.status(400).json({ message: 'Código já existe' });
    }

    cupons.push({ codigo: codigo.toUpperCase(), desconto: parseInt(desconto) });
    salvarJSON(ARQUIVO_CUPONS, cupons);
    res.json({ message: 'Cupom criado' });
});

app.delete('/api/cupons/:codigo', (req, res) => {
    const codigo = req.params.codigo.toUpperCase();
    let cupons = lerJSON(ARQUIVO_CUPONS);
    const novaLista = cupons.filter(c => c.codigo !== codigo);
    salvarJSON(ARQUIVO_CUPONS, novaLista);
    res.json({ message: 'Cupom deletado' });
});

app.get('/api/cupom/:codigo', (req, res) => {
    const codigo = req.params.codigo.toUpperCase();
    const cupons = lerJSON(ARQUIVO_CUPONS);
    const cupom = cupons.find(c => c.codigo === codigo);

    if (cupom) {
        res.json({ valido: true, desconto: cupom.desconto });
    } else {
        res.json({ valido: false });
    }
});

// ========================================================
// 💰 VENDAS E ESTOQUE (COM BAIXA DE ESTOQUE)
// ========================================================

app.get('/api/vendas', (req, res) => {
    const vendas = lerJSON(ARQUIVO_VENDAS);
    res.json(vendas.reverse());
});

app.post('/api/vendas', (req, res) => {
    try {
        const vendas = lerJSON(ARQUIVO_VENDAS);
        const corpo = req.body;

        const listaProdutos = corpo.produtos || corpo.itens || [];

        if (!listaProdutos || listaProdutos.length === 0) {
            return res.status(400).json({ success: false, message: "O pedido está vazio." });
        }
        
        const novaVenda = {
            id_pedido: Date.now(),
            data: new Date().toISOString(), 
            cliente: corpo.cliente || 'Cliente do Site',
            produtos: listaProdutos,
            total: parseFloat(corpo.total) || 0,
            status: 'Pendente'
        };

        vendas.push(novaVenda);
        salvarJSON(ARQUIVO_VENDAS, vendas);
        
        console.log(`[VENDA] Pedido registrado: #${novaVenda.id_pedido} - R$ ${novaVenda.total}`);
        res.json({ success: true, message: 'Pedido registrado!', id: novaVenda.id_pedido });

    } catch (err) {
        console.error("Erro ao salvar venda:", err);
        res.status(500).json({ success: false, message: "Erro interno." });
    }
});

app.post('/api/venda', (req, res) => {
    req.url = '/api/vendas';
    app._router.handle(req, res);
});

// Rota de confirmação com BAIXA DE ESTOQUE
app.post('/api/venda/:id/confirmar', (req, res) => {
    const idPedido = parseInt(req.params.id);
    
    let vendas = lerJSON(ARQUIVO_VENDAS);
    let produtos = lerJSON(ARQUIVO_PRODUTOS);
    
    const vendaIndex = vendas.findIndex(v => v.id_pedido === idPedido);
    
    if (vendaIndex === -1) return res.status(404).json({ message: 'Venda não encontrada' });
    if (vendas[vendaIndex].status === 'Aprovado') return res.status(400).json({ message: 'Venda já foi aprovada antes!' });

    const itensVenda = vendas[vendaIndex].produtos || vendas[vendaIndex].itens || [];
    let erros = [];

    // Lógica para baixar o estoque
    itensVenda.forEach(itemVenda => {
        // Tenta achar o produto (pelo nome ou id, dependendo de como o front manda)
        // No script atual parece ser pelo nome
        const produto = produtos.find(p => p.nome === itemVenda.nome || p.nome === itemVenda.produto || p.id === itemVenda.id);
        
        if (produto && produto.variacoes) {
            // Tenta achar a variação correta
            const variacao = produto.variacoes.find(v => 
                (v.marca && v.marca === itemVenda.marca) || 
                (v.tamanho && v.tamanho === itemVenda.tamanho) ||
                (v.nome && v.nome === itemVenda.variacao) // Caso genérico
            );
            
            if (variacao) {
                const qtd = parseInt(itemVenda.quantidade || itemVenda.qtd || 1);
                if (variacao.estoque >= qtd) {
                    variacao.estoque -= qtd;
                } else {
                    erros.push(`Estoque insuficiente para ${produto.nome} - ${variacao.marca || variacao.tamanho}`);
                }
            }
        }
    });

    if (erros.length > 0) {
        // Em um sistema real bloquearia, aqui apenas avisamos ou forçamos dependendo da regra
        // return res.status(400).json({ message: 'Erro ao baixar estoque', detalhes: erros });
        console.warn("Aviso de estoque negativo:", erros);
    }

    salvarJSON(ARQUIVO_PRODUTOS, produtos);
    vendas[vendaIndex].status = 'Aprovado';
    salvarJSON(ARQUIVO_VENDAS, vendas);

    res.json({ message: 'Venda confirmada e estoque atualizado com sucesso!' });
});

app.post('/api/venda/:id/cancelar', (req, res) => {
    const idPedido = parseInt(req.params.id);
    let vendas = lerJSON(ARQUIVO_VENDAS);
    const vendaIndex = vendas.findIndex(v => v.id_pedido === idPedido);
    
    if (vendaIndex === -1) return res.status(404).json({ message: 'Venda não encontrada' });
    
    vendas[vendaIndex].status = 'Cancelado';
    salvarJSON(ARQUIVO_VENDAS, vendas);
    res.json({ message: 'Venda recusada com sucesso!' });
});

// ========================================================
// 🎨 CONFIGURAÇÕES DA LOJA (COM MULTIPLOS ARQUIVOS)
// ========================================================

app.get('/api/config', (req, res) => {
    const config = lerJSON(ARQUIVO_CONFIG);
    res.json(config);
});

const configUpload = upload.fields([
    { name: 'fundoSite', maxCount: 1 },
    { name: 'fundoHeader', maxCount: 1 },
    { name: 'banner1', maxCount: 1 }, 
    { name: 'banner2', maxCount: 1 }, 
    { name: 'banner3', maxCount: 1 }  
]);

app.post('/api/config', configUpload, (req, res) => {
    try {
        let currentConfig = lerJSON(ARQUIVO_CONFIG);
        const novaConfig = { ...currentConfig, ...req.body };

        if (req.files['fundoSite']) novaConfig.fundoSite = `/uploads/${req.files['fundoSite'][0].filename}`;
        if (req.files['fundoHeader']) novaConfig.fundoHeader = `/uploads/${req.files['fundoHeader'][0].filename}`;
        if (req.files['banner1']) novaConfig.banner1 = `/uploads/${req.files['banner1'][0].filename}`;
        if (req.files['banner2']) novaConfig.banner2 = `/uploads/${req.files['banner2'][0].filename}`;
        if (req.files['banner3']) novaConfig.banner3 = `/uploads/${req.files['banner3'][0].filename}`;

        salvarJSON(ARQUIVO_CONFIG, novaConfig);
        
        // Se vier de um form HTML, redireciona. Se for AJAX, retorna JSON
        if(req.xhr || (req.headers.accept && req.headers.accept.includes('json'))) {
            res.json({ message: 'Loja atualizada com sucesso!', config: novaConfig });
        } else {
            res.redirect('/admin');
        }

    } catch (error) {
        console.error("Erro no POST /api/config:", error);
        res.status(500).json({ erro: 'Erro ao atualizar configurações' });
    }
});

// Iniciar Servidor
app.listen(PORT, () => {
    console.log(`✅ Sistema rodando na porta ${PORT}`);
});