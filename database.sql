CREATE DATABASE IF NOT EXISTS SGBU;
USE SGBU;

CREATE TABLE IF NOT EXISTS users (
    id INT PRIMARY KEY AUTO_INCREMENT,
    nom VARCHAR(100) NOT NULL,
    prenom VARCHAR(100) NOT NULL,
    email VARCHAR(150) UNIQUE NOT NULL,
    mot_de_passe VARCHAR(200) NOT NULL,
    role VARCHAR(20) NOT NULL,
    date_fin_suspension DATE
);

CREATE TABLE IF NOT EXISTS categories (
    id INT PRIMARY KEY AUTO_INCREMENT,
    nom VARCHAR(100) NOT NULL
);

CREATE TABLE IF NOT EXISTS ressources (
    id INT PRIMARY KEY AUTO_INCREMENT,
    titre VARCHAR(255) NOT NULL,
    auteur VARCHAR(150),
    type VARCHAR(20) NOT NULL,
    quantite INT DEFAULT 1,
    disponible INT DEFAULT 1,
    categories_id INT,
    FOREIGN KEY (categories_id) REFERENCES categories(id)
);

CREATE TABLE IF NOT EXISTS emprunts (
    id INT PRIMARY KEY AUTO_INCREMENT,
    users_id INT NOT NULL,
    ressources_id INT NOT NULL,
    date_emprunt DATETIME,
    date_retour_prevue DATETIME NOT NULL,
    date_retour_reelle DATETIME,
    statut VARCHAR(20) DEFAULT 'en_cours',
    FOREIGN KEY (users_id) REFERENCES users(id),
    FOREIGN KEY (ressources_id) REFERENCES ressources(id)
);

INSERT INTO categories (nom) VALUES
    ('Informatique'),
    ('Mathematiques'),
    ('Litterature'),
    ('Sciences');

INSERT INTO ressources (titre, auteur, type, quantite, disponible, categories_id) VALUES
    ('Apprendre Python', 'Gerard Swinnen', 'livre', 3, 3, 1),
    ('Algorithmique', 'Cormen', 'livre', 2, 2, 1),
    ('Analyse mathematique', 'Roger Godement', 'livre', 2, 2, 2),
    ('Le Petit Prince', 'Saint-Exupery', 'livre', 4, 4, 3),
    ('Science et Vie - Numero 1300', 'Collectif', 'revue', 1, 1, 4),
    ('La Recherche - Edition speciale', 'Collectif', 'revue', 2, 2, 4),
    ('Ordinateur portable HP', 'HP', 'materiel', 5, 5, 1),
    ('Calculatrice TI-83', 'Texas Instruments', 'materiel', 10, 10, 2);

-- Apres avoir cree un compte via /inscription, executer pour devenir bibliothecaire :
-- UPDATE users SET role = 'bibliothecaire' WHERE email = 'votre.email@exemple.fr';
