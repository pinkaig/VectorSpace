/******************************************************************************/
/*!
\group  	CtrlAlt
\file		MonoScript.cs
\author 	Sherman Goh Wee Hao             [10%]
\par    	shermanweehao.goh@digipen.edu
\co-author 	Chase Rodrigues                 [90%]
\par    	rodrigues.i@digipen.edu
\date   	Nov 22, 2024 [week 12]

\brief		This is the Base Class of the Script in C#.
            the virtual methods are being extracted out when loading C#
            in C++ Script Engine.

			reference
			https://buildagameengine.com/scripting/scripts-and-components-mono
\par
		nil


Copyright (C) 2024 DigiPen Institute of Technology.
Reproduction or disclosure of this file or its contents without the
prior written consent of DigiPen Institute of Technology is prohibited.
 */
/******************************************************************************/

using System;
using System.Runtime.CompilerServices;

namespace CtrlAltScripts
{
    public partial class MonoScript : Component
    {

        public MonoScript()
        {
            gameObject = new GameObject(0);
            transform = new Transform();
        }

        public void SetEntity(int id)
        {
            gameObject.ID = id;
            transform.gameObject = gameObject;
            transform.gameObject.ID = id;

            Console.WriteLine("Entity set.");
        }

        public Transform transform { get; internal set; }


        public virtual void Initialize() {

        }
        public virtual void Update(float delta) {

        }
        public virtual void FixedUpdate(float delta) { 
        }
        public virtual void OnDestroy() { }

        public T GetComponent<T>() where T : Component, new()
        {
            //if (!HasComponent<T>())
            //    return null;

            T component = new T() { gameObject = gameObject };
            component.gameObject.ID = gameObject.ID;

            return component;
        }

        public T GetComponentInChild<T>(int index) where T : Component, new()
        {
            //if (!HasComponent<T>())
            //    return null;
#pragma warning disable CS8603
            if (index >= this.gameObject.transform.GetChildCount())
            {
                return null;
            }
#pragma warning restore CS8603
            Console.Write("Object has child ");
            GameObject child = this.gameObject.transform.GetChild(index);
            Console.WriteLine("(ID: {0})", child.ID);
            Console.WriteLine("Grabbing Child at Index {0}", index);
            T component = new T() { gameObject = child };
            Console.WriteLine("Component GameObject ID before setting: {0}", component.gameObject.ID);
            component.gameObject.ID = child.ID;
            Console.WriteLine("Component GameObject ID after setting: {0}", component.gameObject.ID);

            return component;
        }

        public GameObject Instantiate(GameObject obj)
        {
            int id = FunctionCalls.Instantiate(obj.ID);

            GameObject toReturn = new GameObject(id);

            if (obj.transform.GetChildCount() > 0)
            {
                for (int i = 0; i < obj.transform.GetChildCount(); i++)
                {
                    Console.WriteLine("Instantiating Child");
                    GameObject current_child = Instantiate(obj.transform.GetChild(i));

                    Console.WriteLine("Setting Parent");
                    current_child.transform.parent = toReturn;

                    Console.WriteLine("Setting Transform");
                    current_child.transform.position = obj.transform.GetChild(i).transform.position;
                    current_child.transform.z_order = obj.transform.GetChild(i).transform.z_order;
                    Console.Write("Child number ");
                    Console.Write(i);
                    Console.WriteLine("done");
                }
            }


            return toReturn;
        }

        public virtual void WaitForMessage(string message) { }
    }
}