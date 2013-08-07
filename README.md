

AZ Admin
========


Installation
------------

1. Install goose
	
	go get bitbucket.org/liamstask/goose


2. Set db configuration in db/dbconf.yml
	
	cp db/dbconf.yml.example db/dbconf.yml

3. Run migrations
	
	goose up

