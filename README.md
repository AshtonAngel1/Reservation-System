# Reservation System

## Project Links

- Live website: [http://165.227.61.89:3000/](http://165.227.61.89:3000/)
- GitHub repository: [https://github.com/AshtonAngel1/Reservation-System](https://github.com/AshtonAngel1/Reservation-System)

## Business Definition

We are a school-style reservation system where users can reserve rooms, resources, and people (like tutors or technicians).  
For Sprint 1, we created a proof of concept backend and inventory system.

## Sprint 1 Goals & Completion

- [x] GitHub project created and shared with team/Dr. Michaels  
- [x] Website deployed on DigitalOcean droplet  
- [x] Frontend pages:
  - Home page  
  - User login/registration page  
  - Inventory view page  
- [x] User registration & login implemented (basic authentication, password rules, email validation)  
- [x] Database schema created in MySQL:
  - 3 rooms  
  - 3 resources  
  - 3 people  
- [x] Inventory page fetches live data from MySQL  
- [x] Ability to add/remove inventory items verified in database  

## Database Schema

### Rooms
| id | name           | capacity | location  |
|----|----------------|---------|----------|
| 1  | Study Room A   | 4       | 1st Floor|
| 2  | Conference Room| 10      | 2nd Floor|
| 3  | Recording Studio| 2      | Basement |

### Resources
| id | name   | type     | status |
|----|--------|---------|--------|
| 1  | Camera | Media   | Good   |
| 2  | Laptop | Computer| Good   |
| 3  | Tripod | Media   | Fair   |

### People
| id | name    | role          | availability_notes |
|----|---------|---------------|------------------|
| 1  | Alice   | Tutor         | MWF 9-5          |
| 2  | Bob     | Technician    | TTh 10-4         |
| 3  | Charlie | Lab Assistant | Flexible         |

## Notes

- Users are still stored in memory for Sprint 1. Database integration for users will come in the future.  
- Inventory page fetches live MySQL data, which updates automatically when new items are added.

