import datetime
import pymysql
from zoneinfo import ZoneInfo

MAX_EMPRUNTS_SIMULTANES = 5
DUREE_LIVRE_JOURS = 14
DUREE_REVUE_JOURS = 7
DUREE_MATERIEL_HEURES = 24
MULTIPLICATEUR_SANCTION = 2


def get_db():
    return pymysql.connect(
        host="localhost",
        user="root",                  # L'utilisateur configuré sur ta VM
        password="",       # Le mot de passe que tu as défini
        database="SGBU",
        cursorclass=pymysql.cursors.DictCursor
    )
def calculer_date_retour(type_ressource):
    maintenant = datetime.datetime.now()
    if type_ressource == "livre":
        return maintenant + datetime.timedelta(days=DUREE_LIVRE_JOURS)
    if type_ressource == "revue":
        return maintenant + datetime.timedelta(days=DUREE_REVUE_JOURS)
    if type_ressource == "materiel":
        return maintenant + datetime.timedelta(hours=DUREE_MATERIEL_HEURES)
    return maintenant + datetime.timedelta(days=DUREE_LIVRE_JOURS)


def utilisateur_suspendu(curseur, user_id):
    curseur.execute("SELECT date_fin_suspension FROM users WHERE id = %s", (user_id,))
    ligne = curseur.fetchone()
    if ligne and ligne["date_fin_suspension"]:
        return ligne["date_fin_suspension"] >= datetime.date.today()
    return False

def compter_emprunts_actifs(curseur, user_id):
    curseur.execute("SELECT COUNT(*) AS n FROM emprunts WHERE users_id = %s AND statut = 'en_cours'", (user_id,))
    return curseur.fetchone()["n"]
