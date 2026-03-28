import sys
import os
import unittest
sys.path.insert(0, r"c:\Users\dongr\Downloads\keylogger_detection_system\keylogger_detection")

from src.api.auth import register, login, RegisterRequest, LoginRequest, init_db
from fastapi import HTTPException

class TestAuth(unittest.TestCase):
    def setUp(self):
        db_path = os.path.join(r"c:\Users\dongr\Downloads\keylogger_detection_system\keylogger_detection\src\api", "users.db")
        if os.path.exists(db_path):
            try: os.remove(db_path)
            except: pass
        init_db()

    def test_auth_functions(self):
        test_user = "testuser_" + os.urandom(4).hex()
        
        # 1. Register
        req = RegisterRequest(username=test_user, password="password123")
        res = register(req)
        self.assertEqual(res["detail"], "User registered successfully.")
        
        # 2. Duplicate Check
        with self.assertRaises(HTTPException) as cm:
            register(req)
        self.assertEqual(cm.exception.status_code, 400)
        
        # 3. Login
        lq = LoginRequest(username=test_user, password="password123")
        lres = login(lq)
        self.assertIsNotNone(lres.access_token)
        
        # 4. Bad Login
        bq = LoginRequest(username=test_user, password="wrong")
        with self.assertRaises(HTTPException) as cm_login:
            login(bq)
        self.assertEqual(cm_login.exception.status_code, 401)
        
if __name__ == "__main__":
    unittest.main()
