# 🎓 Nir'Info — Gestion Formation

Application web complète de gestion de centre de formation.
- **Backend** : Laravel 10 (PHP 8.1+) + API REST + Laravel Sanctum
- **Frontend** : React 18 + TypeScript + Vite
- **Base de données** : MySQL via WAMP Server (`gestion_formation`)

---

## 📋 Prérequis

| Outil | Version |
|-------|---------|
| PHP | 8.1.x (WAMP) |
| MySQL / MariaDB | 10.6+ (WAMP) |
| Composer | 2.x |
| Node.js | 18+ |
| npm | 9+ |

---

## 🚀 Installation — Backend (Laravel)

### 1. Démarrer WAMP et importer la base de données

1. Lancez **WAMP Server**
2. Ouvrez **phpMyAdmin** → `http://localhost/phpmyadmin`
3. Créez une base de données nommée `gestion_formation`
4. Importez le fichier `gestion_formation.sql` fourni

### 2. Copier et configurer le backend

```bash
# Depuis le dossier du projet
cd backend

# Copier le fichier .env
cp .env.example .env

# Modifier .env selon votre config WAMP :
# DB_DATABASE=gestion_formation
# DB_USERNAME=root
# DB_PASSWORD=          (vide par défaut sur WAMP)
```

### 3. Installer les dépendances PHP

```bash
composer install
```

### 4. Générer la clé applicative

```bash
php artisan key:generate
```

### 5. Créer le lien de stockage (pour les photos)

```bash
php artisan storage:link
```

### 6. Exécuter les migrations (tables users + tokens)

```bash
php artisan migrate
```

### 7. Démarrer le serveur Laravel

```bash
php artisan serve
# → http://localhost:8000
```

---

## 🎨 Installation — Frontend (React)

### 1. Installer les dépendances Node.js

```bash
cd frontend
npm install
```

### 2. Démarrer le serveur de développement

```bash
npm run dev
# → http://localhost:5173
```

---

## 🏃 Démarrage rapide (Windows)

Double-cliquez sur **`start.bat`** à la racine du projet pour lancer les deux serveurs simultanément.

---

## 🌐 Accès à l'application

| URL | Description |
|-----|-------------|
| `http://localhost:5173` | Application React (Frontend) |
| `http://localhost:8000` | API Laravel (Backend) |
| `http://localhost:8000/api/...` | Endpoints REST |

---

## 🔐 Création du premier compte admin

1. Allez sur `http://localhost:5173`
2. Cliquez sur **Espace Admin**
3. Cliquez sur **S'inscrire** pour créer votre compte
4. Connectez-vous avec vos identifiants

---

## 📂 Structure du projet

```
nirinfo_app/
├── backend/                    # Laravel 10
│   ├── app/
│   │   ├── Http/Controllers/   # AuthController, DashboardController, etc.
│   │   └── Models/User.php
│   ├── config/
│   │   ├── cors.php            # CORS pour React
│   │   ├── database.php
│   │   └── sanctum.php
│   ├── database/migrations/    # Migration users
│   ├── routes/api.php          # Toutes les routes REST
│   ├── .env.example
│   └── composer.json
│
├── frontend/                   # React + TypeScript
│   ├── src/
│   │   ├── api/axios.ts        # Config Axios + interceptors
│   │   ├── contexts/AuthContext.tsx
│   │   ├── components/Sidebar.tsx
│   │   ├── pages/
│   │   │   ├── LandingPage.tsx      # Page d'accueil (page 1)
│   │   │   ├── LoginPage.tsx        # Connexion admin (page 2)
│   │   │   ├── RegisterPage.tsx     # Inscription admin
│   │   │   ├── DashboardMenu.tsx    # Menu principal + stats (page 3)
│   │   │   ├── FacturePage.tsx      # Impression factures (pages 12-13)
│   │   │   ├── formation/
│   │   │   │   ├── FormationPage.tsx
│   │   │   │   ├── ModuleTab.tsx    # Gestion modules (page 4)
│   │   │   │   └── SessionTab.tsx   # Session/Horaire/En cours (pages 5-7)
│   │   │   └── etudiant/
│   │   │       ├── EtudiantPage.tsx
│   │   │       └── EtudiantMain.tsx # Étudiant/Inscription/Recouvrement/Pointage (pages 8-11)
│   │   ├── App.tsx
│   │   ├── main.tsx
│   │   └── index.css           # Thème global bleu foncé
│   ├── package.json
│   └── vite.config.ts
│
├── gestion_formation.sql       # Base de données complète
├── start.bat                   # Lancement rapide Windows
└── README.md
```

---

## 🔌 Endpoints API REST

### Auth
| Méthode | Route | Description |
|---------|-------|-------------|
| POST | `/api/login` | Connexion |
| POST | `/api/register` | Inscription |
| POST | `/api/logout` | Déconnexion (auth) |
| GET | `/api/user` | Profil courant (auth) |

### Dashboard
| Méthode | Route | Description |
|---------|-------|-------------|
| GET | `/api/dashboard/stats` | Stats + dernières inscriptions ORDER BY DESC |

### Modules
| Méthode | Route | Description |
|---------|-------|-------------|
| GET | `/api/modules` | Liste (avec ?search=) |
| POST | `/api/modules` | Créer |
| PUT | `/api/modules/{code}` | Modifier |
| DELETE | `/api/modules/{code}` | Supprimer |

### Sessions
| Méthode | Route | Description |
|---------|-------|-------------|
| GET | `/api/sessions` | Liste |
| GET | `/api/sessions/en-cours` | Sessions actives (avec filtres) |
| POST | `/api/sessions` | Créer |
| DELETE | `/api/sessions/{code}` | Supprimer |

### Horaires
| Méthode | Route | Description |
|---------|-------|-------------|
| GET | `/api/horaires` | Liste |
| POST | `/api/horaires` | Créer |
| PUT | `/api/horaires/{code}` | Modifier |
| DELETE | `/api/horaires/{code}` | Supprimer |

### Étudiants
| Méthode | Route | Description |
|---------|-------|-------------|
| GET | `/api/etudiants` | Liste (ORDER BY DESC) |
| POST | `/api/etudiants` | Créer (matricule auto NI-XXXX) |
| PUT | `/api/etudiants/{mat}` | Modifier |
| DELETE | `/api/etudiants/{mat}` | Supprimer |
| POST | `/api/etudiants/{mat}/photo` | Upload photo |

### Inscriptions
| Méthode | Route | Description |
|---------|-------|-------------|
| GET | `/api/inscriptions` | Liste |
| POST | `/api/inscriptions` | Créer |
| DELETE | `/api/inscriptions/{id}` | Supprimer |

### Recouvrements
| Méthode | Route | Description |
|---------|-------|-------------|
| GET | `/api/recouvrements` | Liste |
| POST | `/api/recouvrements` | Créer |
| DELETE | `/api/recouvrements/{id}` | Supprimer |

### Factures
| Méthode | Route | Description |
|---------|-------|-------------|
| POST | `/api/factures/generate` | Générer une facture |

---

## 🎨 Thème & Design

- Couleur primaire : `#1e3a8a` (bleu foncé)
- Couleur accent : `#2563eb` (bleu vif)
- Sidebar : `#0f172a` (noir bleuté)
- Design fidèle aux maquettes fournies

---

## ⚠️ Dépannage

### Erreur CORS
Vérifiez `backend/config/cors.php` et que `SANCTUM_STATEFUL_DOMAINS` dans `.env` inclut `localhost:5173`.

### Erreur de migration
Si les tables existent déjà : `php artisan migrate --ignore-migration-errors` ou importez uniquement le SQL fourni.

### Photo non affichée
Assurez-vous d'avoir exécuté `php artisan storage:link` pour créer le lien symbolique.

### Erreur 401
Vérifiez que le token Bearer est bien envoyé. Reconnectez-vous si nécessaire.
