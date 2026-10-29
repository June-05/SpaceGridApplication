# SpaceGrid: how to run it on your computer

This guide is for a classmate who just cloned the repo and has never seen the project. Follow the steps in order.
The short version is in the [README](../README.md#getting-started).

## 1. What you need

| Tool | Version | Notes |
|---|---|---|
| JDK | 17 or newer | The project is compiled for Java 17. A newer JDK (for example 22) also works. |
| Maven **or** NetBeans | Maven 3.9+ / a NetBeans with Maven support | NetBeans includes its own Maven. |
| XAMPP | any recent one | Provides MySQL (MariaDB). Only the **MySQL** module is needed, not Apache. |
| MySQL Workbench | recommended | The easiest way to run the SQL script. If you don't have it, phpMyAdmin or the command line also work (step 3). |
| Internet | first build only | Maven downloads the libraries. The homepage also needs internet every time (see Troubleshooting). |

## 2. Get the code

```bash
git clone <the-repository-url>
cd SpaceGridApplication
```

## 3. Set up the database

The app reads from a MySQL database called `spacegrid_db`. The file `database/spacegrid_db.sql` creates it with
sample data. **The script DROPS `spacegrid_db` and creates it again, so anything you saved in that database is lost.**

1. Open the **XAMPP Control Panel** and click **Start** next to **MySQL**. It must turn green. (Port 3306.)
2. Run the script. **MySQL Workbench (option A) is the recommended way.** Options B and C are alternatives if you don't have Workbench.

**A. MySQL Workbench (recommended)**
1. Open a connection to `localhost` (user `root`, no password).
2. *File > Open SQL Script...* and choose `database/spacegrid_db.sql`.
3. Click the lightning icon (*Execute*). Wait until the output panel shows no red errors.

**B. phpMyAdmin (alternative)**
1. Open `http://localhost/phpmyadmin` (needs the Apache module of XAMPP running).
2. Click the **Import** tab, choose `database/spacegrid_db.sql` and click **Import**.
   Do not pick a database first: the script creates it.

**C. Command line (alternative)** (Windows, XAMPP in the default folder):

```bash
C:\xampp\mysql\bin\mysql.exe -u root < database/spacegrid_db.sql
```

On macOS/Linux use the `mysql` that comes with your XAMPP (or MariaDB) install: `mysql -u root < database/spacegrid_db.sql`.

## 4. Check the settings

Open `src/main/resources/application.properties`. For a normal XAMPP these values are already right:

| Setting | Default | Change it when |
|---|---|---|
| `spring.datasource.url` | `jdbc:mysql://localhost:3306/spacegrid_db?serverTimezone=Asia/Manila&characterEncoding=UTF-8` | your MySQL uses another port (for example 3307) |
| `spring.datasource.username` | `root` | you made another MySQL user |
| `spring.datasource.password` | *(empty)* | your `root` has a password |
| `server.port` | `8080` | port 8080 is used by another program |

**Do not commit your own changes to this file.** Instead of editing it you can set an environment variable. For
a MySQL on port 3307:

```bash
set SPRING_DATASOURCE_URL=jdbc:mysql://localhost:3307/spacegrid_db?serverTimezone=Asia/Manila&characterEncoding=UTF-8
```

(macOS/Linux: `export SPRING_DATASOURCE_URL=...`. In NetBeans: Project Properties > Run > Environment Variables.)
`SPRING_DATASOURCE_PASSWORD` and `SERVER_PORT` work the same way.

## 5. Run the app

Pick one.

**A. NetBeans**
1. *File > Open Project* and choose the project folder.
2. Right-click the project > **Clean and Build** (first time: needs internet).
3. Right-click the project > **Run**. Wait for the line `Started SpaceGridApplication` in the Output window.

**B. Maven in a terminal**

```bash
mvn spring-boot:run
```

(Windows without Maven installed: use the one inside NetBeans, or `mvnw.cmd` if the project has it. The repo has no wrapper at the moment.)

**C. The built JAR**

```bash
mvn clean package
java -jar target/SpaceGridApplication-1.0-SNAPSHOT.jar
```

Stop the app with **Ctrl+C** (terminal) or the red square (NetBeans).

## 6. Open it in the browser

| Page | URL |
|---|---|
| Public homepage (no login needed) | <http://localhost:8080/> |
| Log in | <http://localhost:8080/login> |
| Register a new account | <http://localhost:8080/register> |
| Lease requests (after login) | <http://localhost:8080/requests> |
| Landlord dashboard (after login as a landlord) | <http://localhost:8080/landlord/dashboard.html> |
| Renter dashboard (after login as a renter) | <http://localhost:8080/renter/dashboard.html> |

After logging in, you are sent to the right dashboard for your role.

### Test logins

All passwords are `password123`. Today in the demo story is **2026-10-29**; the dates, states (UPCOMING, DUE, OVERDUE...) and payments are fixed for that day. Full plan: [dummy-data-plan.md](projectfiles/dummy-data-plan.md).

| Username | Role | What it demonstrates |
|---|---|---|
| `landlord` | Landlord | The fullest account: 7 properties (all six types; ACTIVE, ARCHIVED, DRAFT), every unit status, leases in several states, a lease waiting for its move-out, overdue rent |
| `landlord2` | Landlord | A smaller mix (commercial, night market, open space); an auto-ended lease waiting for its move-out; an approved request that still needs a lease |
| `landlord3` | Landlord | Almost new: one DRAFT property with an unfinished grid, no leases (empty state) |
| `renter` | Renter | The fullest renter: leases in every state, three landlords, all four request statuses |
| `renter2` | Renter | Two ACTIVE leases with different landlords; quarterly and arrears payment terms; paid ahead; overdue |
| `renter3` | Renter | A renewal chain of three leases, a TERMINATED lease and an auto-ended one, both waiting for the move-out |
| `renter4` | Renter | No leases, only PENDING and DECLINED requests |
| `renter5` | Renter | Brand new, nothing at all, no e-mail or phone (empty state; cannot send a request yet) |
| `maria.santos` | Landlord | Original sample data: 3 properties, units, leases, payments |
| `jose.reyes` | Landlord | Original sample data: market stalls and a night market |
| `ana.cruz`, `paolo.garcia`, `liza.mendoza` | Renter | Original sample leases, payments and requests |

The `LeaseExpiryJob` runs at startup and ends leases whose end date is before today, so lease 9 (`renter`, Townhouse 1) shows up as automatically ENDED, not EXPIRED.

## 7. Reset the database

Run `database/spacegrid_db.sql` again (step 3). It deletes everything in `spacegrid_db` and brings back the sample
data. Uploaded photos and PDFs are saved as files in the `uploads/` folder next to the project, not in the
database. Delete that folder too if you want a fully clean start (stop the app first).

## 8. Troubleshooting

**"Could not find or load main class ${start-class}"** (NetBeans)
NetBeans did not read the main class from `pom.xml`. Check that `pom.xml` has
`com.techhub.spacegridapplication.SpaceGridApplication` in **both** `<start-class>` and `<exec.mainClass>`, then
*Clean and Build* and run again. If it still happens, close and reopen the project.

**"Port 8080 was already in use" / "Web server failed to start"**
Another program (or a second copy of this app) uses port 8080. Stop it, or set `server.port` (or the
`SERVER_PORT` environment variable) to another number such as 8081, then open `http://localhost:8081/`.

**"Communications link failure", "Connection refused" or the app stops while starting**
MySQL is not running. Start **MySQL** in the XAMPP Control Panel, make sure it is green, and run the app again.
If XAMPP shows a different port than 3306, see step 4.

**"Unknown database 'spacegrid_db'"**
You have not run the SQL script yet (or it stopped with an error). Do step 3 again.

**"Access denied for user 'root'"**
Your MySQL `root` has a password. Set it in `spring.datasource.password` or in the `SPRING_DATASOURCE_PASSWORD`
environment variable.

**The page is white, looks old or shows old data**
Press **Ctrl+F5** to reload without the browser's saved copy. Check the address: it must be
`http://localhost:8080/...` (not `https`, and not a file opened from your folder). After a change in a script or a
page, rebuild or restart the app.

**The homepage has no styling, or the icons are missing**
The pages load Tailwind CSS (`cdn.tailwindcss.com`), Font Awesome (`cdnjs.cloudflare.com`) and a Google font from the
internet. Without internet they look broken. Connect and press Ctrl+F5.

**Dates or times look one day off**
The connection URL has `serverTimezone=Asia/Manila`. Keep it when you change the URL.

**"This feature isn't implemented yet." (HTTP 501)**
The server answers 501 when a method still contains `throw new UnsupportedOperationException("TODO")`.
In the current version all the endpoints are written, so if you see this message after changing the code,
you probably left a TODO in a method you edited.

**The login says the username or password is wrong**
All sample passwords are `password123`. If you registered your own account, the password needs at least 8
characters. If the database was reset, accounts you registered are gone.
