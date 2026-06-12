# Fichier qui regroupe tout ce qui touche a la base de donnees
# et aux regles metiers (durees d'emprunt, sanctions, etc.)

import datetime
import pymysql


# --- Regles metiers (cahier des charges) ---
MAX_EMPRUNTS_SIMULTANES = 5
DUREE_LIVRE_JOURS = 14
DUREE_REVUE_JOURS = 7
DUREE_MATERIEL_HEURES = 24
MULTIPLICATEUR_SANCTION = 2


# Connexion a la base de donnees MySQL
def get_db():
    return pymysql.connect(
        host="localhost",
        user="root",
        password="",
        database="SGBU",
        cursorclass=pymysql.cursors.DictCursor
    )


# Calcule la date a laquelle la ressource doit etre rendue, selon son type
def calculer_date_retour(type_ressource):
    maintenant = datetime.datetime.now()
    if type_ressource == "livre":
        return maintenant + datetime.timedelta(days=DUREE_LIVRE_JOURS)
    if type_ressource == "revue":
        return maintenant + datetime.timedelta(days=DUREE_REVUE_JOURS)
    if type_ressource == "materiel":
        return maintenant + datetime.timedelta(hours=DUREE_MATERIEL_HEURES)
    return maintenant + datetime.timedelta(days=DUREE_LIVRE_JOURS)


# Dit si un utilisateur est actuellement suspendu (a cause d'un retard)
def utilisateur_suspendu(curseur, user_id):
    curseur.execute("SELECT date_fin_suspension FROM users WHERE id = %s", (user_id,))
    ligne = curseur.fetchone()
    if ligne and ligne["date_fin_suspension"]:
        return ligne["date_fin_suspension"] >= datetime.date.today()
    return False


# Compte combien d'emprunts en cours a un utilisateur
def compter_emprunts_actifs(curseur, user_id):
    curseur.execute("SELECT COUNT(*) AS n FROM emprunts WHERE users_id = %s AND statut = 'en_cours'", (user_id,))
    return curseur.fetchone()["n"]
