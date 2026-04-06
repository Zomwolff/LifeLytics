# **LifeLytics**
**Website**: https://life-lytics.vercel.app/
### *All analytics about your life all in one place.*
●Health data is scattered and hard to interpret\
●No simple way to track overall health trends\
●Lack of real-time feedback and early
health risk detection.

## **Idea** 
A unified personal health dashboard that converts raw data into actionable AI insights. It helps the user to understand their health in a simple way and take relavant actions. 


## **Key Features**
●Comprehensive health tracking (includes BMI, weight tracking and body fat percentage)\
●Nutrition & Lifestyle monitoring\
●AI-Powered health Insights & Recommendations


## **Impact**
●Improves health awaraness and better understanding 
●Enables data-driven daily decisions
●Provides personalized guidance
●Scalable for real world applications 
●Early detection of potential health risks



## Folder Structure
```
LifeLytics/
├── .gitignore
├── api/
│   ├── prescription-follow-up.js
│   ├── prescription-scan.js
│   └── trends-weekly.js
├── backend/
│   ├── __init__.py
│   ├── firebase_key.json.example
│   ├── main.py
│   ├── models/
│   │   └── schemas.py
│   ├── routes/
│   │   ├── __init__.py
│   │   ├── chatbot.py
│   │   ├── health.py
│   │   ├── insights.py
│   │   ├── nutrition.py
│   │   ├── test.py
│   │   ├── upload.py
│   │   └── users.py
│   ├── services/
│   │   ├── __init__.py
│   │   ├── chatbotService.py
│   │   ├── healthService.py
│   │   ├── insightService.py
│   │   ├── llmService.py
│   │   ├── reportParser.py
│   │   ├── simulationService.py
│   │   └── userService.py
│   └── utils/
│       ├── __init__.py
│       ├── auth.py
│       ├── cache.py
│       ├── datetime_ist.py
│       ├── firebase.py
│       ├── firestore_db.py
│       ├── logger.py
│       └── rate_limiter.py
├── CLEANUP_REFACTORING.md
├── COMPLETION_REPORT.md
├── docker-compose.yml
├── Dockerfile
├── FIRESTORE_COMPLETION.md
├── FIRESTORE_REFACTORING.md
├── frontend/
│   ├── ...]]
│   ├── .gitignore
│   ├── [--include
│   ├── [--omit
│   ├── [backend]
│   ├── [frontend
│   ├── ]
│   ├── 11.12.1
│   ├── Dockerfile
│   ├── ERROR
│   ├── index.html
│   ├── package-lock.json
│   ├── package.json
│   ├── postcss.config.js
│   ├── public/
│   │   ├── avatars/
│   │   │   ├── 1.png
│   │   │   ├── 2.png
│   │   │   ├── 3.png
│   │   │   ├── 4.png
│   │   │   ├── 5.png
│   │   │   └── 6.png
│   │   ├── images/
│   │   │   └── welcome.png
│   │   ├── manifest.json
│   │   ├── pwa-icon.svg
│   │   └── sw.js
│   ├── src/
│   │   ├── api/
│   │   │   └── client.js
│   │   ├── App.jsx
│   │   ├── auth.js
│   │   ├── components/
│   │   │   ├── AvatarRotator.jsx
│   │   │   ├── Card.jsx
│   │   │   └── InputField.jsx
│   │   ├── firebase.js
│   │   ├── index.css
│   │   ├── main.jsx
│   │   └── pages/
│   │       ├── AiInsights.jsx
│   │       ├── Chatbot.jsx
│   │       ├── FoodLog.jsx
│   │       ├── Home.jsx
│   │       ├── Login.jsx
│   │       ├── Metrics.jsx
│   │       ├── Profile.jsx
│   │       ├── SetupMetrics.jsx
│   │       ├── Signup.jsx
│   │       ├── Startup.jsx
│   │       └── Trends.jsx
│   ├── tailwind.config.js
│   ├── vercel.json
│   └── vite.config.js
├── LICENSE
├── LLM_INTEGRATION.md
├── OPTIMIZATION_VERIFICATION.md
├── OPTIMIZATIONS.md
├── README.md
├── requirements.txt
├── SETUP_GUIDE.md
├── SIMULATION_SYSTEM.md
└── vercel.json
```
