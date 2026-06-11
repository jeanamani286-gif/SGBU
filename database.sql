-- Base de donnees du projet SGBU
-- Systeme de Gestion de Bibliotheque Universitaire

CREATE DATABASE IF NOT EXISTS SGBU;
USE SGBU;


-- Table des utilisateurs (etudiants et bibliothecaires)
CREATE TABLE IF NOT EXISTS users (
    id INT PRIMARY KEY AUTO_INCREMENT,
    nom VARCHAR(100) NOT NULL,
    prenom VARCHAR(100) NOT NULL,
    email VARCHAR(150) UNIQUE NOT NULL,
    mot_de_passe VARCHAR(200) NOT NULL,
    role VARCHAR(20) NOT NULL,
    date_fin_suspension DATE
);


-- Table des categories de ressources
CREATE TABLE IF NOT EXISTS categories (
    id INT PRIMARY KEY AUTO_INCREMENT,
    nom VARCHAR(100) NOT NULL
);


-- Table des ressources (livres, revues, materiel)
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


-- Table des emprunts (gere aussi les reservations via le statut)
-- statut possibles : 'reserve', 'en_cours', 'retourne', 'retard'
CREATE TABLE IF NOT EXISTS emprunts (
    id INT PRIMARY KEY AUTO_INCREMENT,
    users_id INT NOT NULL,
    ressources_id INT NOT NULL,
    date_emprunt DATE,
    date_retour_prevue DATE NOT NULL,
    date_retour_reelle DATE,
    statut VARCHAR(20) DEFAULT 'en_cours',
    FOREIGN KEY (users_id) REFERENCES users(id),
    FOREIGN KEY (ressources_id) REFERENCES ressources(id)
);

