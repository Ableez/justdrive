# justdrive multi-machine test env

Build and start three machines:

    docker compose up -d --build

Log in each one (approve the device code in your browser):

    docker exec -it jd-machine-a justdrive login --name machine-a
    docker exec -it jd-machine-b justdrive login --name machine-b

Send a file from machine-a to machine-b:

    docker exec jd-machine-a sh -c 'echo hello > /data/hello.txt'
    docker exec jd-machine-a justdrive send /data/hello.txt --to machine-b

Receive it on machine-b:

    docker exec -it jd-machine-b justdrive receive

Clean up:

    docker compose down