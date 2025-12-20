#COS 498 Midterm Project - README\
Instructor: Troy Schotter\
Author: Sarah Turmel\

##Instructions for running the project:\
	- Clone the COS-498-Repo repository onto your server.\
	- Navigate into the cloned repository: cd COS-498-Repo.\
	- From here, use the command "docker compose build" to build the containers and images.\
	- Next, use the command "docker compose up" to start running the containers.\
	- Go to your browser and navigate to keengreenmachine.org.\
	- Set up the nginx proxy manager.\
##Database Schema\
The table schema are as follows:\
	- Users: username, email, password, displayname, namecolor, bio, last_login\
	- Sessions: username, starttime\
	- Comments: author, body, timeposted, color\
	- Login_attempts: id, ip_address, username, attempt_time, success\
	- Chats: id, author, timeposted, color, message\
The index schema are as follows:\
	- Idx_login_attempts_ip_username: ip_address, username, attempt_time\
##Other Notes\
Known limitations: due to the email services being dropped as a requirement, they do not exist in this project.\
Security features: all required security features have been implemented, including password hashing.\
For Nginx Proxy Manager setup, note that the name of the domain is keengreenmachine.org or www.keengreenmachine.org and when prompted, the port is 3000.\
Design decisions: due to time constraints, the website does not look as nice as it could, though it is readable.\

