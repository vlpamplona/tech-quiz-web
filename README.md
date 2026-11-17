# 🧠 Tech Translation Quiz Web

[![Python](https://img.shields.io/badge/Python-3.10%2B-blue?logo=python&logoColor=white)](https://www.python.org/)
[![Flask](https://img.shields.io/badge/Flask-3.0%2B-black?logo=flask&logoColor=white)](https://flask.palletsprojects.com/)
[![JavaScript](https://img.shields.io/badge/JavaScript-ES6%2B-yellow?logo=javascript&logoColor=black)](https://developer.mozilla.org/)
[![HTML5 & CSS3](https://img.shields.io/badge/Frontend-HTML5%20%7C%20CSS3-orange?logo=html5&logoColor=white)](https://developer.mozilla.org/)
[![License: MIT](https://img.shields.io/badge/License-MIT-green.svg)](LICENSE)

Aplicação web interativa para praticar, testar e fixar o vocabulário técnico em inglês mais utilizado no mercado de TI (DevOps, Cloud, Backend, IA, Cibersegurança e mais). O jogo desafia o participante a traduzir termos de **Português para Inglês** contra o relógio, com feedback imediato, síntese de voz e pontuação gamificada.

---

## 🎯 Destaques e Funcionalidades

- **📚 Banco com 106+ Termos Técnicos em 8 Categorias:**
  - **DevOps:** CI/CD, Container, Orchestration, Pipeline, Rollback, Staging, etc.
  - **Banco de Dados:** Primary Key, Foreign Key, Stored Procedure, Constraint, Query, etc.
  - **Frontend:** Responsive Design, Lazy Loading, State Management, Rendering, etc.
  - **Backend:** Endpoints, Middleware, Rate Limiting, Message Queue, Error Handling, etc.
  - **Cibersegurança:** Encryption, Two-factor Authentication, Penetration Testing, SQL Injection, etc.
  - **Computação em Nuvem:** Serverless, Scalability, High Availability, Disaster Recovery, CDN, etc.
  - **Inteligência Artificial:** Machine Learning, Neural Networks, Fine-Tuning, Overfitting, etc.
  - **Hardware:** Motherboard, Processor, Solid State Drive, Power Supply, Bus, etc.
- **⏱️ Cronômetro Dinâmico:** 20 segundos por questão com anel SVG animado e alertas visuais progressivos de urgência.
- **🎲 Rodízio Inteligente & Distratores Contextuais:**
  - Sistema de histórico (`historico.json`) que prioriza perguntas inéditas a cada nova partida, garantindo que o banco de questões seja completamente aproveitado antes de repetir termos.
  - Alternativas incorretas (distratores) selecionadas prioritariamente dentro da mesma categoria técnica para elevar o nível do desafio.
- **🔊 Pronúncia em Inglês (Text-to-Speech):** Suporte nativo à Web Speech API para ouvir a pronúncia em inglês do termo correto após responder.
- **🏆 Gamificação & Ranking:**
  - +100 pontos por acerto.
  - Estatísticas completas ao fim da partida (tempo decorrido, taxa de acerto e patamar atingido: *Mestre da tecnologia!*, *Muito bem!*, *Conhecedor em evolução* ou *Iniciante em tecnologia*).
  - Efeito visual de confetes para comemorar bons resultados.
- **🛡️ Arquitetura Segura & Anti-Cheat:**
  - Toda a lógica de sorteio, verificação e pontuação reside exclusivamente no servidor backend (Flask).
  - O gabarito da questão **nunca** é enviado ao cliente antes que o jogador responda ou o tempo esgote.
  - Prevenção contra respostas duplicadas e requisições dessincronizadas por controle de época e ID de partida.
- **🎨 Design Moderno & Responsivo:** Interface escura estilo *cyberpunk/tech*, efeito *glassmorphism*, microinterações suaves e suporte para telas móveis e desktop.

---

## 🚀 Tecnologias Utilizadas

- **Backend:** Python 3.10+, Flask 3.0+
- **Frontend:** Vanilla JavaScript (ES6+), HTML5 Semântico, CSS3 Moderno (Custom Properties, Flexbox/Grid, Canvas API, animações nativas)
- **Testes:** Framework `unittest` padrão do Python

---

## 💻 Como Rodar o Projeto Localmente

### Pré-requisitos
- [Python 3.10+](https://www.python.org/) instalado
- [Git](https://git-scm.com/) instalado

### Passo a passo

1. **Clone o repositório:**
   ```bash
   git clone https://github.com/vlpamplona/tech-quiz-web.git
   cd tech-quiz-web
   ```

2. **Crie e ative um ambiente virtual:**
   - **Linux / macOS:**
     ```bash
     python3 -m venv .venv
     source .venv/bin/activate
     ```
   - **Windows (PowerShell):**
     ```powershell
     python -m venv .venv
     .\.venv\Scripts\Activate.ps1
     ```
   - **Windows (CMD):**
     ```cmd
     python -m venv .venv
     .\.venv\Scripts\activate.bat
     ```

3. **Instale as dependências:**
   ```bash
   pip install -r requirements.txt
   ```

4. **Inicie o servidor:**
   ```bash
   python app.py
   ```

5. **Acesse no navegador:**
   Abra [http://127.0.0.1:5000](http://127.0.0.1:5000) no seu navegador preferido.

---

## 🧪 Executando os Testes

O projeto conta com uma suíte de testes unitários que valida o banco de termos, a lógica de sorteio, o rodízio sem repetição, a pontuação, o ranking e o controle de trapaças/validações:

```bash
python -m unittest discover -s tests -v
```

---

## 📁 Estrutura de Arquivos

```text
tech-quiz-web/
├── app.py              # Aplicação Flask e endpoints da API REST
├── quiz_data.py        # Banco de dados com os termos técnicos e categorias
├── quiz_logic.py       # Regras do jogo: sorteio, distratores, pontuação e ranking
├── requirements.txt    # Dependências do projeto (Flask)
├── historico.json      # Histórico de IDs utilizados para rodízio contínuo
├── static/
│   ├── app.js          # Lógica frontend, cronômetro, áudio, confetti e API client
│   └── style.css       # Estilos visuais, glassmorphism e animações
├── templates/
│   └── index.html      # Estrutura HTML da aplicação (Home, Quiz, Resumo)
└── tests/
    └── test_quiz.py    # Suíte completa de testes unitários
```

---

## 🔌 Endpoints da API

| Método | Rota | Descrição |
|---|---|---|
| `GET` | `/` | Renderiza a página principal do jogo |
| `POST` | `/api/start` | Inicia uma partida e retorna a 1ª pergunta (sem gabarito) |
| `POST` | `/api/answer` | Valida a resposta escolhida (ou timeout) e retorna o gabarito |
| `POST` | `/api/next` | Avança para a próxima pergunta ou retorna o resumo final |

---

## 📝 Licença

Distribuído sob a licença MIT. Consulte `LICENSE` para mais informações.
